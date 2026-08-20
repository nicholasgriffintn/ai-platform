import { createConversationTitleExcerpt } from "@ngriffin_uk/polychat-schemas";

import { isCompactionMarkerMessage } from "~/lib/chat/messages/parts";
import { MessageFormatter } from "~/lib/formatter/messages";
import type { Message } from "~/types";

export function createInitialConversationTitle(messages: Message[]): string {
  const sourceMessage = messages.find(
    (message) =>
      message.role === "user" &&
      !isCompactionMarkerMessage(message) &&
      MessageFormatter.stringifyMessageContent(message.content).trim(),
  );
  const sourceText = sourceMessage
    ? MessageFormatter.stringifyMessageContent(sourceMessage.content)
    : "";

  return createConversationTitleExcerpt(sourceText);
}
