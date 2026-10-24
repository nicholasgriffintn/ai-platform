import {
  itemsToMessages,
  messagesToItems,
  toResponse,
  type ChatRun,
  type Conversation,
  type StoredItem,
} from "@ngriffin_uk/polychat-schemas";

import { readStoredSubject } from "~/modules/conversations/domain/subject";
import type { Message } from "~/types";

interface ConversationRecordLike extends Record<string, unknown> {
  messages?: Message[];
  latest_run?: ChatRun | null;
  message_count?: number;
  has_more_messages?: boolean;
  oldest_message_id?: string | null;
}

export function presentConversation(record: ConversationRecordLike): Conversation {
  const {
    messages,
    latest_run: latestRun,
    message_count: messageCount,
    has_more_messages: hasMoreMessages,
    oldest_message_id: oldestMessageId,
    subject_type: _subjectType,
    subject_id: _subjectId,
    ...rest
  } = record;
  const subject = readStoredSubject(record);

  return {
    ...(rest as Conversation),
    object: "conversation",
    ...(subject ? { subject } : {}),
    ...(latestRun !== undefined
      ? { latest_response: latestRun ? toResponse(latestRun) : null }
      : {}),
    ...(messages ? { items: messagesToItems(messages) } : {}),
    ...(messageCount !== undefined ? { item_count: messageCount } : {}),
    ...(hasMoreMessages !== undefined ? { has_more_items: hasMoreMessages } : {}),
    ...(oldestMessageId !== undefined ? { oldest_item_id: oldestMessageId } : {}),
  };
}

export function presentItems(messages: Message[]): StoredItem[] {
  return messagesToItems(messages);
}

export function toApiMessages(items: readonly StoredItem[]): Message[] {
  return itemsToMessages(items).map(
    (message) => ({ ...message, content: message.content ?? "" }) as Message,
  );
}
