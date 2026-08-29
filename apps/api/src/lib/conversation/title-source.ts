import {
  createConversationTitleExcerpt,
  DEFAULT_CONVERSATION_TITLE,
} from "@ngriffin_uk/polychat-schemas";

import { isCompactionMarkerMessage } from "~/lib/chat/messages/parts";
import { MessageFormatter } from "~/lib/formatter/messages";
import type { Message } from "~/types";

const UNTITLED = new Set(["", DEFAULT_CONVERSATION_TITLE.toLowerCase(), "untitled"]);

/**
 * An opening message this short rarely says what the conversation is about, so
 * a title taken from it alone is worth replacing once the reply lands.
 */
const RICHER_CONTEXT_LENGTH = 40;

export function getConversationTitleSourceText(messages: Message[]): string {
  const sourceMessage = messages.find(
    (message) =>
      message.role === "user" &&
      !isCompactionMarkerMessage(message) &&
      MessageFormatter.stringifyMessageContent(message.content).trim(),
  );

  return sourceMessage ? MessageFormatter.stringifyMessageContent(sourceMessage.content) : "";
}

export function createInitialConversationTitle(messages: Message[]): string {
  return createConversationTitleExcerpt(getConversationTitleSourceText(messages));
}

export function isPlaceholderConversationTitle(title: unknown, messages: Message[]): boolean {
  const current = typeof title === "string" ? title.trim() : "";

  if (UNTITLED.has(current.toLowerCase())) {
    return true;
  }

  return current === createInitialConversationTitle(messages);
}

export function needsRicherTitleContext(messages: Message[]): boolean {
  return getConversationTitleSourceText(messages).trim().length < RICHER_CONTEXT_LENGTH;
}
