import { MessageFormatter } from "../lib/formatter";
import type { Message } from "../types";

export function formatMessages(
  provider: string,
  messageHistory: Message[],
  system_prompt?: string,
  model?: string,
): Message[] {
  return MessageFormatter.formatMessages(messageHistory, {
    provider,
    model,
    system_prompt,
    maxTokens: 0,
    truncationStrategy: "tail",
  });
}
