const DB_NAME = "ncert-books-pdf-cache";
const DB_VERSION = 2;
const STORE_PDFS = "pdfs";
/** Soft cap — oldest entries are evicted when exceeded. */
const MAX_CACHED_PDFS = 48;
/** Fail each network attempt quickly; UX retries instead of a long hang. */
const FETCH_TIMEOUT_MS = 14_000;
const FETCH_ATTEMPTS = 2;

type PdfCacheRecord = {
  url: string;
  bookId: string;
  data: ArrayBuffer;
  updatedAt: number;
};

export type PdfFetchAttemptInfo = {
  attempt: number;
  maxAttempts: number;
  reason: "start" | "retry";
};

export type PdfFetchErrorKind = "timeout" | "not_found" | "upstream" | "unknown";

const inflightFetches = new Map<string, Promise<ArrayBuffer>>();

export function getPdfProxyUrl(officialUrl: string): string {
  return `/api/pdf?url=${encodeURIComponent(officialUrl)}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB open failed"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PDFS)) {
        db.createObjectStore(STORE_PDFS, { keyPath: "url" });
      }
      if (db.objectStoreNames.contains("progress")) {
        db.deleteObjectStore("progress");
      }
    };
  });
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

async function getCachedPdf(url: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_PDFS, "readonly");
      const record = await idbRequest<PdfCacheRecord | undefined>(
        tx.objectStore(STORE_PDFS).get(url),
      );
      if (!record?.data || record.data.byteLength === 0) return null;
      return record.data.slice(0);
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

async function evictOldestIfNeeded(db: IDBDatabase): Promise<void> {
  const tx = db.transaction(STORE_PDFS, "readwrite");
  const store = tx.objectStore(STORE_PDFS);
  const all = await idbRequest<PdfCacheRecord[]>(store.getAll());
  if (all.length < MAX_CACHED_PDFS) return;

  const overflow = all.length - MAX_CACHED_PDFS + 1;
  const oldest = all
    .slice()
    .sort((a, b) => a.updatedAt - b.updatedAt)
    .slice(0, overflow);
  await Promise.all(oldest.map((record) => idbRequest(store.delete(record.url))));
}

async function putCachedPdf(
  url: string,
  bookId: string,
  data: ArrayBuffer,
): Promise<void> {
  try {
    const db = await openDb();
    try {
      await evictOldestIfNeeded(db);
      const tx = db.transaction(STORE_PDFS, "readwrite");
      await idbRequest(
        tx.objectStore(STORE_PDFS).put({
          url,
          bookId,
          data,
          updatedAt: Date.now(),
        } satisfies PdfCacheRecord),
      );
    } finally {
      db.close();
    }
  } catch {
    // Quota / private mode — ignore.
  }
}

export class PdfHttpError extends Error {
  status: number;
  kind: PdfFetchErrorKind;

  constructor(status: number, message: string, kind: PdfFetchErrorKind) {
    super(message);
    this.name = "PdfHttpError";
    this.status = status;
    this.kind = kind;
  }
}

export function classifyPdfFetchError(error: unknown): PdfFetchErrorKind {
  if (error instanceof PdfHttpError) return error.kind;
  if (error instanceof DOMException && error.name === "AbortError") {
    return "timeout";
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("abort") || message.includes("timeout")) {
      return "timeout";
    }
    if (message.includes("404") || message.includes("not found")) {
      return "not_found";
    }
    if (message.includes("502") || message.includes("503") || message.includes("upstream")) {
      return "upstream";
    }
  }
  return "unknown";
}

export function describePdfFetchError(error: unknown): string {
  const kind = classifyPdfFetchError(error);
  switch (kind) {
    case "timeout":
      return "NCERT took too long to respond. Tap Try again.";
    case "not_found":
      return "This section isn’t available on NCERT.";
    case "upstream":
      return "NCERT is temporarily unavailable. Tap Try again in a moment.";
    case "unknown":
      return "Something went wrong loading this PDF. Tap Try again.";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

async function fetchPdfBytes(officialUrl: string): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(getPdfProxyUrl(officialUrl), {
      // Prefer cached proxy/CDN responses when available.
      cache: "force-cache",
      signal: controller.signal,
    });
    if (response.status === 404) {
      throw new PdfHttpError(404, "PDF not found on NCERT", "not_found");
    }
    if (!response.ok) {
      throw new PdfHttpError(
        response.status,
        `Failed to download PDF (${response.status})`,
        "upstream",
      );
    }
    const data = await response.arrayBuffer();
    if (data.byteLength < 100) {
      throw new Error("Downloaded PDF was empty");
    }
    return data;
  } catch (error) {
    if (error instanceof PdfHttpError) throw error;
    if (
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && /abort/i.test(error.message))
    ) {
      throw new PdfHttpError(408, "PDF download timed out", "timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

type FetchAndCacheOptions = {
  onAttempt?: (info: PdfFetchAttemptInfo) => void;
};

/**
 * Download (or reuse cache) PDF bytes. Concurrent callers for the same URL
 * share one network request.
 */
export async function fetchAndCachePdf(
  officialUrl: string,
  bookId: string,
  options?: FetchAndCacheOptions,
): Promise<ArrayBuffer> {
  const cached = await getCachedPdf(officialUrl);
  if (cached && cached.byteLength > 100) return cached;

  const existing = inflightFetches.get(officialUrl);
  if (existing) return existing.then((data) => data.slice(0));

  const request = (async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt += 1) {
      options?.onAttempt?.({
        attempt: attempt + 1,
        maxAttempts: FETCH_ATTEMPTS,
        reason: attempt === 0 ? "start" : "retry",
      });
      try {
        const data = await fetchPdfBytes(officialUrl);
        void putCachedPdf(officialUrl, bookId, data);
        return data;
      } catch (error) {
        lastError = error;
        // Missing files won't appear on retry.
        if (error instanceof PdfHttpError && error.kind === "not_found") break;
        if (attempt + 1 < FETCH_ATTEMPTS) {
          const delay = 400 * (attempt + 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("Failed to download PDF");
  })();

  inflightFetches.set(officialUrl, request);
  try {
    const data = await request;
    return data.slice(0);
  } finally {
    inflightFetches.delete(officialUrl);
  }
}

/** Warm IDB/HTTP cache without opening a PDF.js document. */
export function prefetchPdf(officialUrl: string, bookId: string): void {
  void fetchAndCachePdf(officialUrl, bookId).catch(() => {
    // Prefetch is best-effort.
  });
}

/**
 * Open a fully-downloaded PDF. Streaming partial documents caused intermittent
 * inverted / black / incomplete first-page paints, so we always buffer first.
 */
export async function openPdfDocument(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfjs: any,
  officialUrl: string,
  bookId: string,
  options?: FetchAndCacheOptions,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const data = await fetchAndCachePdf(officialUrl, bookId, options);
  return pdfjs.getDocument({
    data: new Uint8Array(data.slice(0)),
    disableAutoFetch: true,
    disableStream: true,
  }).promise;
}

/** First numbered chapter (skips Prelims) — best candidate for warm start. */
export function getFirstContentChapterUrl(
  chapters: Array<{ title: string; pdfUrl: string }>,
): string | null {
  const chapter =
    chapters.find((item) => item.title !== "Prelims") ?? chapters[0] ?? null;
  return chapter?.pdfUrl ?? null;
}
