import type { IDBPDatabase } from "idb";

import {
	getDatabase,
	isIndexedDBSupported,
	storeName,
} from "~/hooks/useIndexedDB";
import type { Conversation, Message } from "~/types/chat";

const LS_PREFIX = "polychat_conversation_";

/**
 * Service for managing local chat conversations using IndexedDB.
 * This is a singleton service that provides methods for CRUD operations on chat data.
 * Falls back to LocalStorage when IndexedDB is not supported.
 */
class LocalChatService {
	private static instance: LocalChatService;
	private isDBSupported: boolean;
	private dbPromise: Promise<IDBPDatabase> | null = null;

	private constructor() {
		this.isDBSupported = isIndexedDBSupported();
		if (!this.isDBSupported) {
			if (typeof window !== "undefined") {
				console.warn(
					"IndexedDB is not supported in this browser. Using LocalStorage instead.",
				);
			}
		} else {
			// Pre-initialize the database connection
			this.dbPromise = getDatabase();
		}
	}

	/**
	 * Get the singleton instance of the LocalChatService.
	 */
	public static getInstance(): LocalChatService {
		if (!LocalChatService.instance) {
			LocalChatService.instance = new LocalChatService();
		}
		return LocalChatService.instance;
	}

	/**
	 * Save a chat to LocalStorage.
	 */
	private saveToLocalStorage(chat: Conversation): void {
		try {
			window.localStorage.setItem(
				`${LS_PREFIX}${chat.id}`,
				JSON.stringify(chat),
			);
		} catch (error) {
			console.error("Error saving to LocalStorage:", error);
		}
	}

	/**
	 * Get a chat from LocalStorage.
	 */
	private getFromLocalStorage(chatId: string): Conversation | null {
		try {
			const chatJson = window.localStorage.getItem(`${LS_PREFIX}${chatId}`);
			return chatJson ? JSON.parse(chatJson) : null;
		} catch (error) {
			console.error("Error retrieving from LocalStorage:", error);
			return null;
		}
	}

	/**
	 * Get all chats from LocalStorage.
	 */
	private getAllFromLocalStorage(): Conversation[] {
		try {
			const chats: Conversation[] = [];
			for (let i = 0; i < window.localStorage.length; i++) {
				const key = window.localStorage.key(i);
				if (key?.startsWith(LS_PREFIX)) {
					const chatJson = window.localStorage.getItem(key);
					if (chatJson) {
						chats.push(JSON.parse(chatJson));
					}
				}
			}
			return chats;
		} catch (error) {
			console.error("Error retrieving all chats from LocalStorage:", error);
			return [];
		}
	}

	/**
	 * Delete a chat from LocalStorage.
	 */
	private deleteFromLocalStorage(chatId: string): void {
		try {
			window.localStorage.removeItem(`${LS_PREFIX}${chatId}`);
		} catch (error) {
			console.error("Error deleting from LocalStorage:", error);
		}
	}

	/**
	 * Get the database connection, caching it for future use
	 */
	private async getDB(): Promise<IDBPDatabase> {
		if (!this.dbPromise) {
			this.dbPromise = getDatabase();
		}
		return this.dbPromise;
	}

	/**
	 * Get all local chats from storage.
	 */
	private async getLocalChats(): Promise<Conversation[]> {
		if (!this.isDBSupported) {
			return this.getAllFromLocalStorage();
		}

		try {
			const db = await this.getDB();
			const allChats = await db.getAll(storeName);
			return allChats || [];
		} catch (error) {
			console.error("Error retrieving local chats from IndexedDB:", error);
			return [];
		}
	}

	/**
	 * Save a chat to storage.
	 * @param chat The chat to save
	 */
	public async saveLocalChat(chat: Conversation): Promise<void> {
		const chatWithFlag = {
			...chat,
			isLocalOnly: true,
		};

		if (!chatWithFlag.id) {
			chatWithFlag.id = crypto.randomUUID();
		}

		if (!this.isDBSupported) {
			this.saveToLocalStorage(chatWithFlag);
			return;
		}

		try {
			const db = await this.getDB();
			await db.put(storeName, chatWithFlag);
		} catch (error) {
			console.error("Error saving chat to IndexedDB:", error);
		}
	}

	/**
	 * List all local chats.
	 */
	public async listLocalChats(): Promise<Conversation[]> {
		return this.getLocalChats();
	}

	/**
	 * Get a specific chat by ID.
	 * @param chatId The ID of the chat to get
	 */
	public async getLocalChat(chatId: string): Promise<Conversation | null> {
		if (!this.isDBSupported) {
			return this.getFromLocalStorage(chatId);
		}

		try {
			const db = await this.getDB();
			const chat = await db.get(storeName, chatId);
			return chat || null;
		} catch (error) {
			console.error("Error retrieving chat from IndexedDB:", error);
			return null;
		}
	}

	/**
	 * Update the messages of a chat.
	 * @param chatId The ID of the chat to update
	 * @param messages The new messages
	 */
	public async updateLocalChatMessages(
		chatId: string,
		messages: Message[],
	): Promise<void> {
		try {
			const chat = await this.getLocalChat(chatId);

			if (chat) {
				chat.messages = messages;
				await this.saveLocalChat(chat);
			}
		} catch (error) {
			console.error("Error updating chat messages:", error);
		}
	}

	/**
	 * Update the title of a chat.
	 * @param chatId The ID of the chat to update
	 * @param title The new title
	 */
	public async updateLocalChatTitle(
		chatId: string,
		title: string,
	): Promise<void> {
		try {
			const chat = await this.getLocalChat(chatId);

			if (chat) {
				chat.title = title;
				await this.saveLocalChat(chat);
			}
		} catch (error) {
			console.error("Error updating chat title:", error);
		}
	}

	/**
	 * Delete a chat.
	 * @param chatId The ID of the chat to delete
	 */
	public async deleteLocalChat(chatId: string): Promise<void> {
		if (!this.isDBSupported) {
			this.deleteFromLocalStorage(chatId);
			return;
		}

		try {
			const db = await this.getDB();
			await db.delete(storeName, chatId);
		} catch (error) {
			console.error("Error deleting chat from IndexedDB:", error);
		}
	}

	/**
	 * Delete all local chats from storage.
	 */
	public async deleteAllLocalChats(): Promise<void> {
		if (!this.isDBSupported) {
			const keys = Object.keys(window.localStorage);
			for (const key of keys) {
				if (key.startsWith(LS_PREFIX)) {
					window.localStorage.removeItem(key);
				}
			}
			return;
		}

		try {
			const db = await this.getDB();
			const allChats = await db.getAll(storeName);
			for (const chat of allChats) {
				await db.delete(storeName, chat.id);
			}
		} catch (error) {
			console.error("Error deleting all chats from IndexedDB:", error);
		}
	}
}

export const localChatService = LocalChatService.getInstance();
