const DB_NAME = "ncert-books-pdf-cache";
const DB_VERSION = 2;
const STORE_PDFS = "pdfs";

type PdfCacheRecord = {
  url: string;
  bookId: string;
  data: ArrayBuffer;
  updatedAt: number;
};

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

async function fetchPdfBytes(officialUrl: string): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(getPdfProxyUrl(officialUrl), {
      cache: "force-cache",
      signal: controller.signal,
    });
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
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const data = await fetchPdfBytes(officialUrl);
      void putCachedPdf(officialUrl, bookId, data);
      return data.slice(0);
    } catch (error) {
      lastError = error;
      const delay = Math.min(1500, 300 * 2 ** attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to download PDF");
}

/**
 * Open a PDF with IndexedDB-first, then streaming URL (faster first paint).
 * Persists bytes into IndexedDB after a streamed open when possible.
 */
export async function openPdfDocument(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfjs: any,
  officialUrl: string,
  bookId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const cached = await getCachedPdf(officialUrl);
  if (cached && cached.byteLength > 100) {
    return pdfjs.getDocument({
      data: new Uint8Array(cached.slice(0)),
    }).promise;
  }

  try {
    const pdf = await pdfjs.getDocument({
      url: getPdfProxyUrl(officialUrl),
      disableStream: false,
      disableAutoFetch: false,
    }).promise;

    void (async () => {
      try {
        const data = (await pdf.getData()) as Uint8Array;
        const copy = data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength,
        ) as ArrayBuffer;
        if (copy.byteLength > 100) {
          await putCachedPdf(officialUrl, bookId, copy);
        }
      } catch {
        // ignore cache write failures
      }
    })();

    return pdf;
  } catch {
    // Fall back to full buffered download + parse.
    const data = await fetchAndCachePdf(officialUrl, bookId);
    return pdfjs.getDocument({
      data: new Uint8Array(data.slice(0)),
    }).promise;
  }
}
