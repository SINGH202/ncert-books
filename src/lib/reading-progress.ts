export type ReadingProgress = {
  bookId: string;
  globalPage: number;
  metaIndex: number;
  pageInChapter: number;
  updatedAt: number;
};

const DB_NAME = "ncert-books-reading-progress";
const DB_VERSION = 1;
const STORE = "progress";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB open failed"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "bookId" });
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

export async function getReadingProgress(
  bookId: string,
): Promise<ReadingProgress | null> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readonly");
      const record = await idbRequest<ReadingProgress | undefined>(
        tx.objectStore(STORE).get(bookId),
      );
      if (!record || !Number.isFinite(record.globalPage) || record.globalPage < 1) {
        return null;
      }
      return record;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function saveReadingProgress(
  progress: ReadingProgress,
): Promise<void> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readwrite");
      await idbRequest(tx.objectStore(STORE).put(progress));
    } finally {
      db.close();
    }
  } catch {
    // Private mode / quota — ignore.
  }
}

export async function clearReadingProgress(bookId: string): Promise<void> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readwrite");
      await idbRequest(tx.objectStore(STORE).delete(bookId));
    } finally {
      db.close();
    }
  } catch {
    // ignore
  }
}
