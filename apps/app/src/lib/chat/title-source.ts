import { isCompactionMarkerMessage } from "@ngriffin_uk/polychat-library-chat/message-compaction-status";
import { getMessageTextContent } from "@ngriffin_uk/polychat-library-chat/messages";
import {
  createConversationTitleExcerpt,
  DEFAULT_CONVERSATION_TITLE,
} from "@ngriffin_uk/polychat-schemas";

import type { Message } from "~/types";

export function getConversationTitleSourceMessage(messages: Message[]): Message | undefined {
  return messages.find(
    (message) =>
      message.role === "user" &&
      !isCompactionMarkerMessage(message) &&
      getMessageTextContent(message),
  );
}

export function createTemporaryConversationTitle(messages: Message[], maxLength?: number): string {
  const sourceMessage = getConversationTitleSourceMessage(messages);
  const titleText = sourceMessage ? getMessageTextContent(sourceMessage) : "";

  return createConversationTitleExcerpt(titleText, maxLength);
}

export function isPlaceholderConversationTitle(
  title: string | undefined,
  messages: Message[],
): boolean {
  const current = title?.trim() ?? "";

  if (!current || current === DEFAULT_CONVERSATION_TITLE) {
    return true;
  }

  return current === createTemporaryConversationTitle(messages);
}
