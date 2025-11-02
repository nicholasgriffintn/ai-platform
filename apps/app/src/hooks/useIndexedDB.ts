import { type IDBPDatabase, openDB } from "idb";
import { useEffect, useState } from "react";

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
		return Promise.reject(
			new Error("IndexedDB is not supported in this browser"),
		);
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

interface IndexedDBState {
	db: IDBPDatabase | null;
	loading: boolean;
	error: Error | null;
	isSupported: boolean;
}

let hookState: IndexedDBState = {
	db: null,
	loading: true,
	error: null,
	isSupported: isIndexedDBSupported(),
};

let _subscribers = 0;

/**
 * React hook for IndexedDB access.
 * Use this in components that need to interact with the database.
 */
export function useIndexedDB() {
	const [state, setState] = useState<IndexedDBState>(hookState);

	useEffect(() => {
		let mounted = true;
		_subscribers++;

		if (hookState.loading && !hookState.db && !hookState.error) {
			const initDb = async () => {
				if (!hookState.isSupported) {
					const newState = {
						...hookState,
						loading: false,
						error: new Error("IndexedDB is not supported in this browser"),
					};
					hookState = newState;
					if (mounted) setState(newState);
					return;
				}

				try {
					const database = await getDatabase();
					const newState = {
						...hookState,
						db: database,
						loading: false,
					};
					hookState = newState;
					if (mounted) setState(newState);
				} catch (err) {
					console.error("Failed to initialize IndexedDB:", err);
					const newState = {
						...hookState,
						loading: false,
						error: err as Error,
					};
					hookState = newState;
					if (mounted) setState(newState);
				}
			};

			initDb();
		} else if (hookState !== state && mounted) {
			setState(hookState);
		}

		return () => {
			mounted = false;
			_subscribers--;
		};
	}, [state]);

	return state;
}
