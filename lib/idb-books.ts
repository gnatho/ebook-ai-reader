// Client-side EPUB byte storage (IndexedDB). Cloud-downloaded books persist
// here so they can be re-opened without re-downloading.

const DB_NAME = "ebook-reader";
const DB_VERSION = 1;
const STORE = "books";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

export function putBook(id: string, bytes: ArrayBuffer): Promise<void> {
  return run("readwrite", (s) => s.put(bytes, id)).then(() => undefined);
}

export function getBook(id: string): Promise<ArrayBuffer | undefined> {
  return run<ArrayBuffer | undefined>("readonly", (s) => s.get(id));
}

export function deleteBook(id: string): Promise<void> {
  return run("readwrite", (s) => s.delete(id)).then(() => undefined);
}

export function hasBook(id: string): Promise<boolean> {
  return run<number>("readonly", (s) => s.count(id)).then((n) => n > 0);
}
