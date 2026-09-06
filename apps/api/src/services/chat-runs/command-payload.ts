import { chatRunCommandInputSchema } from "@ngriffin_uk/polychat-schemas";

import type { CoreChatOptions, Message } from "~/types";

function toCommandMessage(message: Message) {
  const hasParts = Boolean(message.parts?.length);
  const hasContent =
    message.content !== undefined &&
    message.content !== null &&
    (typeof message.content !== "string" || message.content.trim() !== "");

  if (hasParts && !hasContent) {
    const { content: _content, ...messageWithParts } = message;

    return messageWithParts;
  }

  const { parts: _parts, ...messageWithContent } = message;

  return messageWithContent;
}

export function buildChatRunCommandPayload(options: CoreChatOptions) {
  return chatRunCommandInputSchema.parse({
    ...options,
    messages: options.messages?.map(toCommandMessage),
  });
}
