import type { EncryptedValue } from "./model";
import { decryptBytes, encryptBytes } from "./crypto";
import { getSessionCryptoKey } from "./vault";

const DB_NAME = "resumepilot-assets";
const DB_VERSION = 1;
const STORE = "encrypted-assets";

export interface StoredAsset extends EncryptedValue {
  id: string;
}

async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("无法打开附件库"));
  });
}

async function runRequest<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("附件库操作失败"));
    });
  } finally {
    db.close();
  }
}

export async function saveAssetBytes(id: string, bytes: Uint8Array<ArrayBuffer>): Promise<void> {
  const encrypted = await encryptBytes(bytes, await getSessionCryptoKey(), id);
  await runRequest("readwrite", (store) => store.put({ id, ...encrypted } satisfies StoredAsset));
}

export async function readAssetBytes(id: string): Promise<Uint8Array<ArrayBuffer>> {
  const record = await runRequest<StoredAsset | undefined>("readonly", (store) => store.get(id));
  if (!record) throw new Error("附件不存在或已被删除");
  return decryptBytes(record, await getSessionCryptoKey(), id);
}

export async function deleteAssetBytes(id: string): Promise<void> {
  await runRequest("readwrite", (store) => store.delete(id));
}

export async function exportEncryptedAssets(): Promise<StoredAsset[]> {
  return runRequest<StoredAsset[]>("readonly", (store) => store.getAll());
}

export async function replaceEncryptedAssets(records: StoredAsset[]): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      store.clear();
      for (const record of records) store.put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("无法恢复附件库"));
      transaction.onabort = () => reject(transaction.error ?? new Error("附件库恢复已中止"));
    });
  } finally {
    db.close();
  }
}
