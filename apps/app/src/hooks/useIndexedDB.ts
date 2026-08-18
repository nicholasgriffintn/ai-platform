import { type IDBPDatabase, openDB } from "idb";

export const storeName = "conversations";
export const dbName = "polychat";

let dbInstance: IDBPDatabase | null = null;
let dbPromise: Promise<IDBPDatabase> | null = null;

export const isIndexedDBSupported = () => {
  return typeof window !== "undefined" && "indexedDB" in window;
};

/**
 * Get or initialize the database connection.
 * This can be used directly in services that don't need React hooks.
 */
export const getDatabase = async (): Promise<IDBPDatabase> => {
  if (!isIndexedDBSupported()) {
    return Promise.reject(new Error("IndexedDB is not supported in this browser"));
  }

  if (dbInstance) {
    return dbInstance;
  }

  if (!dbPromise) {
    dbPromise = openDB(dbName, 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore(storeName, {
            keyPath: "id",
            autoIncrement: true,
          });
        }
      },
    }).then((db) => {
      dbInstance = db;

      return db;
    });
  }

  return dbPromise;
};
