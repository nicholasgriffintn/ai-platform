import type { Conversation, ConversationListOptions, Message } from "./conversation-types";

export interface LocalChatExport {
  version: 1;
  exportedAt: string;
  conversationCount: number;
  conversations: Conversation[];
}

export interface LocalConversationStore {
  saveLocalChat: (chat: Conversation) => Promise<void>;
  listLocalChats: () => Promise<Conversation[]>;
  getLocalChat: (chatId: string) => Promise<Conversation | null>;
  updateLocalChatMessages: (chatId: string, messages: Message[]) => Promise<void>;
  updateLocalChatTitle: (chatId: string, title: string) => Promise<void>;
  setLocalChatsArchived: (archived: boolean, options?: ConversationListOptions) => Promise<number>;
  deleteLocalChat: (chatId: string) => Promise<void>;
  deleteAllLocalChats: () => Promise<void>;
  exportLocalChats: () => Promise<LocalChatExport>;
  importLocalChats: (value: unknown) => Promise<number>;
}

let store: LocalConversationStore | null = null;

export function setLocalConversationStore(next: LocalConversationStore): void {
  store = next;
}

export function localConversationStore(): LocalConversationStore {
  if (!store) {
    throw new Error(
      "This host has not provided a local conversation store. Call setLocalConversationStore during start-up.",
    );
  }

  return store;
}
