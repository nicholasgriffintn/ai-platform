import type { Message } from "~/types/chat";
import { sanitiseInput } from "~/utils/sanitise";

export function sanitiseMessages(messages: Message[]): Message[] {
  return messages.map((msg) => {
    if (msg.role === "user" || msg.role === "developer") {
      if (typeof msg.content === "string") {
        return { ...msg, content: sanitiseInput(msg.content) };
      }

      if (Array.isArray(msg.content)) {
        const sanitisedContent = msg.content.map((part) =>
          part.type === "text" && part.text ? { ...part, text: sanitiseInput(part.text) } : part,
        );

        return { ...msg, content: sanitisedContent };
      }
    }

    return msg;
  });
}
