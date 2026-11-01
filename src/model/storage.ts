// Local persistence: each organisation is stored as its full Loro snapshot in
// IndexedDB. Nothing leaves the browser unless the user exports a file.

export interface StoredOrg {
  id: string;
  name: string;
  updatedAt: number;
  bytes: Uint8Array;
}

export type OrgSummary = Omit<StoredOrg, "bytes">;

const DB_NAME = "orgmap";
const STORE = "orgs";

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function request<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(d.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function listOrgs(): Promise<OrgSummary[]> {
  const all = await request<StoredOrg[]>("readonly", (s) => s.getAll());
  return all.map(({ id, name, updatedAt }) => ({ id, name, updatedAt })).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadOrg(id: string): Promise<StoredOrg | undefined> {
  return request<StoredOrg | undefined>("readonly", (s) => s.get(id));
}

export function saveOrg(org: StoredOrg): Promise<IDBValidKey> {
  return request("readwrite", (s) => s.put(org));
}

export function deleteOrg(id: string): Promise<undefined> {
  return request("readwrite", (s) => s.delete(id));
}
