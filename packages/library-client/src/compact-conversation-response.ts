import { readCompactionStatusMessage } from "@ngriffin_uk/polychat-library-chat/message-compaction-status";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import { normaliseConversationItems } from "./conversation-response.js";

export interface CompactConversationResponse {
  compacted: boolean;
  conversation: {
    messages: unknown[];
    [key: string]: unknown;
  };
}

export function parseCompactConversationResponse(
  value: unknown,
): CompactConversationResponse | null {
  if (!isRecord(value) || typeof value.compacted !== "boolean" || !isRecord(value.conversation)) {
    return null;
  }

  const items = value.conversation.items ?? value.conversation.messages;

  if (!Array.isArray(items)) {
    return null;
  }

  const messages = normaliseConversationItems(items);

  if (value.compacted && !messages.some((message) => readCompactionStatusMessage(message))) {
    return null;
  }

  const { items: _items, ...conversation } = value.conversation;

  void _items;

  return {
    compacted: value.compacted,
    conversation: {
      ...conversation,
      messages,
    },
  };
}
