import {
  buildLocalChatExport,
  readLocalChatExport,
  setLocalConversationStore,
  type LocalChatExport,
  getLocalChatScope,
  isConversationInLocalScope,
} from "@ngriffin_uk/polychat-library-chat";
import type {
  Conversation,
  ConversationListOptions,
  Message,
} from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { filterConversationsByListOptions } from "@ngriffin_uk/polychat-library-chat/conversations";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import type { IDBPDatabase } from "idb";

import { getDatabase, isIndexedDBSupported, storeName } from "./useIndexedDB.js";

const LS_PREFIX = "polychat_conversation_";

class LocalChatService {
  private static instance: LocalChatService;
  private isDBSupported: boolean;
  private dbPromise: Promise<IDBPDatabase> | null = null;

  private constructor() {
    this.isDBSupported = isIndexedDBSupported();
    if (!this.isDBSupported) {
      if (typeof window !== "undefined") {
        console.warn("IndexedDB is not supported in this browser. Using LocalStorage instead.");
      }
    } else {
      this.dbPromise = getDatabase();
    }
  }

  private getCurrentScope(): string {
    return getLocalChatScope(useChatStore.getState().user?.id);
  }

  public static getInstance(): LocalChatService {
    if (!LocalChatService.instance) {
      LocalChatService.instance = new LocalChatService();
    }

    return LocalChatService.instance;
  }

  private saveToLocalStorage(chat: Conversation): void {
    try {
      window.localStorage.setItem(`${LS_PREFIX}${chat.id}`, JSON.stringify(chat));
    } catch (error) {
      console.error("Error saving to LocalStorage:", error);
      throw error;
    }
  }

  private getFromLocalStorage(chatId: string): Conversation | null {
    try {
      const chatJson = window.localStorage.getItem(`${LS_PREFIX}${chatId}`);
      const chat = chatJson ? (JSON.parse(chatJson) as Conversation) : null;

      return chat && isConversationInLocalScope(chat, this.getCurrentScope()) ? chat : null;
    } catch (error) {
      console.error("Error retrieving from LocalStorage:", error);

      return null;
    }
  }

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

      return chats.filter((chat) => isConversationInLocalScope(chat, this.getCurrentScope()));
    } catch (error) {
      console.error("Error retrieving all chats from LocalStorage:", error);

      return [];
    }
  }

  private deleteFromLocalStorage(chatId: string): void {
    try {
      window.localStorage.removeItem(`${LS_PREFIX}${chatId}`);
    } catch (error) {
      console.error("Error deleting from LocalStorage:", error);
    }
  }

  private async getDB(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = getDatabase();
    }

    return this.dbPromise;
  }

  private async getLocalChats(): Promise<Conversation[]> {
    if (!this.isDBSupported) {
      return this.getAllFromLocalStorage();
    }

    try {
      const db = await this.getDB();
      const allChats = await db.getAll(storeName);

      return (allChats || []).filter((chat) =>
        isConversationInLocalScope(chat, this.getCurrentScope()),
      );
    } catch (error) {
      console.error("Error retrieving local chats from IndexedDB:", error);
      throw error;
    }
  }

  public async saveLocalChat(chat: Conversation): Promise<void> {
    const chatWithFlag = {
      ...chat,
      isLocalOnly: chat.isLocalOnly ?? true,
      localOwnerScope: this.getCurrentScope(),
      parent_conversation_id: chat.parent_conversation_id,
      parent_message_id: chat.parent_message_id,
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
      throw error;
    }
  }

  public async listLocalChats(): Promise<Conversation[]> {
    return this.getLocalChats();
  }

  public async getLocalChat(chatId: string): Promise<Conversation | null> {
    if (!this.isDBSupported) {
      return this.getFromLocalStorage(chatId);
    }

    try {
      const db = await this.getDB();
      const chat = await db.get(storeName, chatId);

      return chat && isConversationInLocalScope(chat, this.getCurrentScope()) ? chat : null;
    } catch (error) {
      console.error("Error retrieving chat from IndexedDB:", error);

      return null;
    }
  }

  public async updateLocalChatMessages(chatId: string, messages: Message[]): Promise<void> {
    try {
      const chat = await this.getLocalChat(chatId);

      if (chat) {
        chat.messages = messages;
        await this.saveLocalChat(chat);
      }
    } catch (error) {
      console.error("Error updating chat messages:", error);
      throw error;
    }
  }

  public async updateLocalChatTitle(chatId: string, title: string): Promise<void> {
    try {
      const chat = await this.getLocalChat(chatId);

      if (chat) {
        chat.title = title;
        await this.saveLocalChat(chat);
      }
    } catch (error) {
      console.error("Error updating chat title:", error);
      throw error;
    }
  }

  public async setLocalChatsArchived(
    archived: boolean,
    options: ConversationListOptions = {},
  ): Promise<number> {
    const matching = filterConversationsByListOptions(await this.listLocalChats(), {
      ...options,
      archived: archived ? "active" : "archived",
    });

    await Promise.all(
      matching.map((chat) => this.saveLocalChat({ ...chat, is_archived: archived })),
    );

    return matching.length;
  }

  public async deleteLocalChat(chatId: string): Promise<void> {
    if (!(await this.getLocalChat(chatId))) {
      return;
    }

    if (!this.isDBSupported) {
      this.deleteFromLocalStorage(chatId);

      return;
    }

    try {
      const db = await this.getDB();

      await db.delete(storeName, chatId);
    } catch (error) {
      console.error("Error deleting chat from IndexedDB:", error);
      throw error;
    }
  }

  public async exportLocalChats(): Promise<LocalChatExport> {
    return buildLocalChatExport(await this.listLocalChats(), new Date().toISOString());
  }

  public async importLocalChats(value: unknown): Promise<number> {
    const conversations = readLocalChatExport(value);

    for (const conversation of conversations) {
      await this.saveLocalChat(conversation);
    }

    return conversations.length;
  }

  public async deleteAllLocalChats(): Promise<void> {
    if (!this.isDBSupported) {
      const keys = Object.keys(window.localStorage);

      for (const key of keys) {
        const chatId = key.startsWith(LS_PREFIX) ? key.slice(LS_PREFIX.length) : null;

        if (chatId && this.getFromLocalStorage(chatId)) {
          window.localStorage.removeItem(key);
        }
      }

      return;
    }

    try {
      const db = await this.getDB();
      const allChats = await db.getAll(storeName);

      for (const chat of allChats) {
        if (isConversationInLocalScope(chat, this.getCurrentScope())) {
          await db.delete(storeName, chat.id);
        }
      }
    } catch (error) {
      console.error("Error deleting all chats from IndexedDB:", error);
      throw error;
    }
  }
}

export const localChatService = LocalChatService.getInstance();

setLocalConversationStore(localChatService);
