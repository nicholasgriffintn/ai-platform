import type { Message } from "~/types";

export function messagesSharedThrough(
  messages: Message[],
  sharedThrough: number | null,
): Message[] {
  if (sharedThrough === null) {
    return [];
  }

  return messages.filter(
    (message) => typeof message.timestamp === "number" && message.timestamp <= sharedThrough,
  );
}
