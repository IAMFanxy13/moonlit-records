import type { PrivateSongRecord } from "./types";

export interface PrivateLibrary {
  list(): Promise<PrivateSongRecord[]>;
  get(id: string): Promise<PrivateSongRecord | null>;
  put(record: PrivateSongRecord): Promise<PrivateSongRecord>;
  remove(id: string): Promise<void>;
}

function isPrivateSongRecord(value: unknown): value is PrivateSongRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<PrivateSongRecord>;
  return Boolean(
    record.id &&
    record.checksum &&
    record.createdAt &&
    record.metadata?.title &&
    record.song?.id &&
    Array.isArray(record.song.events),
  );
}

function newestFirst(records: PrivateSongRecord[]): PrivateSongRecord[] {
  return records.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function createMemoryPrivateLibrary(initial: unknown[] = []): PrivateLibrary {
  const records = new Map(
    initial.filter(isPrivateSongRecord).map((record) => [record.id, structuredClone(record)]),
  );

  return {
    async list() {
      return newestFirst([...records.values()].map((record) => structuredClone(record)));
    },
    async get(id) {
      const record = records.get(id);
      return record ? structuredClone(record) : null;
    },
    async put(record) {
      const existing = [...records.values()].find((item) => item.checksum === record.checksum);
      if (existing && existing.id !== record.id) records.delete(existing.id);
      records.set(record.id, structuredClone(record));
      return structuredClone(record);
    },
    async remove(id) {
      records.delete(id);
    },
  };
}

const DB_NAME = "moonlit-records-private-library";
const STORE_NAME = "arrangements";
const DB_VERSION = 1;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Private library request failed."));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Private library transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Private library transaction was cancelled."));
  });
}

async function openLibraryDb(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) throw new Error("Private browser storage is unavailable.");
  const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
    store.createIndex("checksum", "checksum", { unique: true });
    store.createIndex("createdAt", "createdAt");
  };
  return requestResult(request);
}

export function createIndexedDbPrivateLibrary(): PrivateLibrary {
  return {
    async list() {
      const database = await openLibraryDb();
      try {
        const values = await requestResult(database.transaction(STORE_NAME).objectStore(STORE_NAME).getAll());
        return newestFirst(values.filter(isPrivateSongRecord));
      } finally {
        database.close();
      }
    },
    async get(id) {
      const database = await openLibraryDb();
      try {
        const value = await requestResult(database.transaction(STORE_NAME).objectStore(STORE_NAME).get(id));
        return isPrivateSongRecord(value) ? value : null;
      } finally {
        database.close();
      }
    },
    async put(record) {
      const database = await openLibraryDb();
      try {
        const readTransaction = database.transaction(STORE_NAME);
        const existing = await requestResult(readTransaction.objectStore(STORE_NAME).index("checksum").get(record.checksum));
        const transaction = database.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        if (isPrivateSongRecord(existing) && existing.id !== record.id) store.delete(existing.id);
        store.put(record);
        await transactionComplete(transaction);
        return record;
      } finally {
        database.close();
      }
    },
    async remove(id) {
      const database = await openLibraryDb();
      try {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).delete(id);
        await transactionComplete(transaction);
      } finally {
        database.close();
      }
    },
  };
}
