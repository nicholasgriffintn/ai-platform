import type { Conversation } from "~/types";

export const LOCAL_CHAT_EXPORT_VERSION = 1 as const;

export interface LocalChatExport {
  version: typeof LOCAL_CHAT_EXPORT_VERSION;
  exportedAt: string;
  conversationCount: number;
  conversations: Conversation[];
}

export function buildLocalChatExport(
  conversations: Conversation[],
  exportedAt: string,
): LocalChatExport {
  return {
    version: LOCAL_CHAT_EXPORT_VERSION,
    exportedAt,
    conversationCount: conversations.length,
    conversations,
  };
}

export function readLocalChatExport(value: unknown): Conversation[] {
  if (typeof value !== "object" || value === null) {
    return [];
  }

  const candidate = value as Partial<LocalChatExport>;

  if (candidate.version !== LOCAL_CHAT_EXPORT_VERSION) {
    return [];
  }

  return Array.isArray(candidate.conversations) ? candidate.conversations : [];
}

export function localChatExportFilename(exportedAt: string): string {
  return `polychat-browser-chats-${exportedAt.slice(0, 10)}.json`;
}
