import {
  chatCompletionMessageSchema,
  engineRequestInputSchema,
  type EngineRequest,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { CoreChatOptions } from "~/types";

const commandMessagesSchema = z.array(chatCompletionMessageSchema);

interface CommandMessageSource {
  content?: unknown;
  parts?: readonly unknown[] | null;
}

function toCommandMessage<TMessage extends CommandMessageSource>(message: TMessage) {
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

export function toCommandMessages<TMessage extends CommandMessageSource>(
  messages: readonly TMessage[],
): EngineRequest["messages"] {
  return commandMessagesSchema.parse(messages.map(toCommandMessage));
}

export function buildChatRunCommandPayload(options: CoreChatOptions) {
  return engineRequestInputSchema.parse({
    ...options,
    messages: options.messages?.map(toCommandMessage),
  });
}
