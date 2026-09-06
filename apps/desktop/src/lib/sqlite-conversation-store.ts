import {
  buildLocalChatExport,
  getLocalChatScope,
  isConversationInLocalScope,
  readLocalChatExport,
  setLocalConversationStore,
  type LocalChatExport,
  type LocalConversationStore,
} from "@ngriffin_uk/polychat-library-chat";
import type {
  Conversation,
  ConversationListOptions,
  Message,
} from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { filterConversationsByListOptions } from "@ngriffin_uk/polychat-library-chat/conversations";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { invoke } from "@tauri-apps/api/core";
import z from "zod/v4";

const payloadListSchema = z.string().array();

function currentScope(): string {
  return getLocalChatScope(useChatStore.getState().user?.id);
}

function conversationTimestamp(conversation: Conversation): string {
  return conversation.updated_at ?? conversation.created_at ?? new Date().toISOString();
}

async function readAll(): Promise<Conversation[]> {
  const scope = currentScope();
  const payloads = payloadListSchema.parse(await invoke("list_local_chats", { scope }));
  const conversations: Conversation[] = [];

  for (const payload of payloads) {
    const conversation = JSON.parse(payload) as Conversation;

    if (isConversationInLocalScope(conversation, scope)) {
      conversations.push(conversation);
    }
  }

  return conversations;
}

async function write(conversation: Conversation): Promise<void> {
  await invoke("save_local_chat", {
    scope: currentScope(),
    id: conversation.id,
    payload: JSON.stringify(conversation),
    updatedAt: conversationTimestamp(conversation),
  });
}

async function readOne(chatId: string): Promise<Conversation | null> {
  const conversations = await readAll();

  return conversations.find((conversation) => conversation.id === chatId) ?? null;
}

export const sqliteConversationStore: LocalConversationStore = {
  saveLocalChat: write,
  listLocalChats: readAll,
  getLocalChat: readOne,
  updateLocalChatMessages: async (chatId, messages: Message[]) => {
    const conversation = await readOne(chatId);

    if (!conversation) {
      return;
    }

    await write({ ...conversation, messages, updated_at: new Date().toISOString() });
  },
  updateLocalChatTitle: async (chatId, title) => {
    const conversation = await readOne(chatId);

    if (!conversation) {
      return;
    }

    await write({ ...conversation, title, updated_at: new Date().toISOString() });
  },
  setLocalChatsArchived: async (archived, options: ConversationListOptions = {}) => {
    const matching = filterConversationsByListOptions(await readAll(), {
      ...options,
      archived: archived ? "active" : "archived",
    });

    for (const conversation of matching) {
      await write({ ...conversation, is_archived: archived });
    }

    return matching.length;
  },
  deleteLocalChat: async (chatId) => {
    await invoke("delete_local_chat", { scope: currentScope(), id: chatId });
  },
  deleteAllLocalChats: async () => {
    await invoke("delete_all_local_chats", { scope: currentScope() });
  },
  exportLocalChats: async (): Promise<LocalChatExport> =>
    buildLocalChatExport(await readAll(), new Date().toISOString()),
  importLocalChats: async (value) => {
    const conversations = readLocalChatExport(value);

    for (const conversation of conversations) {
      await write(conversation);
    }

    return conversations.length;
  },
};

setLocalConversationStore(sqliteConversationStore);
