import type { Conversation, Message } from "./conversation-types.js";
import { isCompactionMarkerMessage } from "./message-compaction-status.js";

export interface BranchPoint {
  message: Message;
  messages: Message[];
  shouldGenerateResponse: boolean;
}

export interface BranchConversationParams {
  conversation: Conversation;
  conversationId: string;
  isLocalOnly: boolean;
  messages: Message[];
  parentConversationId: string;
  parentMessageId: string;
}

export function canStartThreadFromMessage(
  message: Pick<Message, "id" | "role" | "parts">,
): boolean {
  return Boolean(
    message.id &&
    !isCompactionMarkerMessage(message) &&
    (message.role === "user" || message.role === "assistant"),
  );
}

export function getThreadPoint(messages: Message[], messageId: string): BranchPoint | null {
  const messageIndex = messages.findIndex((message) => message.id === messageId);

  if (messageIndex === -1) {
    return null;
  }

  const message = messages[messageIndex];

  if (!canStartThreadFromMessage(message)) {
    return null;
  }

  return {
    message,
    messages: messages.slice(0, messageIndex + 1),
    shouldGenerateResponse: message.role === "user",
  };
}

export function createBranchMetadata(parentConversationId: string, parentMessageId: string) {
  return {
    branch_of: JSON.stringify({
      conversation_id: parentConversationId,
      message_id: parentMessageId,
    }),
  };
}

export function createConversationThread({
  conversation,
  conversationId,
  isLocalOnly,
  messages,
  parentConversationId,
  parentMessageId,
}: BranchConversationParams): Conversation {
  const now = new Date().toISOString();

  return {
    id: conversationId,
    type: conversation.type,
    title: conversation.title || "Branched Conversation",
    messages,
    parent_conversation_id: parentConversationId,
    parent_message_id: parentMessageId,
    project_id: conversation.project_id,
    isLocalOnly,
    created_at: now,
    updated_at: now,
    last_message_at: now,
  };
}
