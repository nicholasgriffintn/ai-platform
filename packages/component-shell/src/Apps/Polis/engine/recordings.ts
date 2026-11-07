import type { PolisRecording } from "@ngriffin_uk/polychat-schemas";

import type { PolisRecordingSummary } from "./protocol.js";

const DATABASE = "polis-recordings";
const STORE = "recordings";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);

    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open saved towns"));
  });
}

function settle<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not reach saved towns"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();

  try {
    return await settle(work(database.transaction(STORE, mode).objectStore(STORE)));
  } finally {
    database.close();
  }
}

export function saveRecording(recording: PolisRecording): Promise<IDBValidKey> {
  return withStore("readwrite", (store) => store.put(recording));
}

export function loadRecording(id: string): Promise<PolisRecording | undefined> {
  return withStore<PolisRecording | undefined>("readonly", (store) => store.get(id));
}

export function forgetRecording(id: string): Promise<undefined> {
  return withStore("readwrite", (store) => store.delete(id));
}

export async function listRecordings(): Promise<PolisRecordingSummary[]> {
  const recordings = await withStore<PolisRecording[]>("readonly", (store) => store.getAll());

  return recordings
    .map(({ log: _log, ...summary }) => summary)
    .sort((first, second) => second.savedAt - first.savedAt);
}
