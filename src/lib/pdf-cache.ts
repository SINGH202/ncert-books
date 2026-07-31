import type { FitMode } from "@/lib/types";

const DB_NAME = "ncert-books-pdf-cache";
const DB_VERSION = 1;
const STORE_PDFS = "pdfs";
const STORE_PROGRESS = "progress";

export type ReaderProgress = {
  bookId: string;
  globalPage: number;
  zoomFactor: number;
  fitMode: FitMode;
  updatedAt: number;
};

type PdfCacheRecord = {
  url: string;
  bookId: string;
  data: ArrayBuffer;
  updatedAt: number;
};

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
      if (!db.objectStoreNames.contains(STORE_PROGRESS)) {
        db.createObjectStore(STORE_PROGRESS, { keyPath: "bookId" });
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

async function putCachedPdf(
  url: string,
  bookId: string,
  data: ArrayBuffer,
): Promise<void> {
  try {
    const db = await openDb();
    try {
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

export async function getReaderProgress(
  bookId: string,
): Promise<ReaderProgress | null> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_PROGRESS, "readonly");
      const record = await idbRequest<ReaderProgress | undefined>(
        tx.objectStore(STORE_PROGRESS).get(bookId),
      );
      return record ?? null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function putReaderProgress(
  progress: ReaderProgress,
): Promise<void> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_PROGRESS, "readwrite");
      await idbRequest(tx.objectStore(STORE_PROGRESS).put(progress));
    } finally {
      db.close();
    }
  } catch {
    // ignore
  }
}

async function fetchPdfBytes(officialUrl: string): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(
      `/api/pdf?url=${encodeURIComponent(officialUrl)}`,
      { cache: "no-store", signal: controller.signal },
    );
    if (!response.ok) {
      throw new Error(`Failed to download PDF (${response.status})`);
    }
    const data = await response.arrayBuffer();
    if (data.byteLength < 100) {
      throw new Error("Downloaded PDF was empty");
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchAndCachePdf(
  officialUrl: string,
  bookId: string,
): Promise<ArrayBuffer> {
  const cached = await getCachedPdf(officialUrl);
  if (cached && cached.byteLength > 100) return cached;

  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const data = await fetchPdfBytes(officialUrl);
      void putCachedPdf(officialUrl, bookId, data);
      return data.slice(0);
    } catch (error) {
      lastError = error;
      const delay = Math.min(3000, 400 * 2 ** attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to download PDF");
}
