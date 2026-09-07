import { hasCompactionPart, isCompactionMarkerMessage } from "./message-part-utils.js";

export type StoredConversationReplacementMessage = {
  parts?: unknown;
  role?: unknown;
};

export function canReplaceStoredConversationMessages(
  messages: readonly StoredConversationReplacementMessage[],
): boolean {
  return !messages.some(
    (message) => isCompactionMarkerMessage(message) || hasCompactionPart(message.parts),
  );
}
