import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { getMessageTextContent } from "@ngriffin_uk/polychat-library-chat/messages";
import type { MachineRunRequest } from "@ngriffin_uk/polychat-schemas";

export function toRunMessages(messages: Message[]): MachineRunRequest["messages"] {
  return messages.flatMap((message) => {
    if (message.role !== "system" && message.role !== "user" && message.role !== "assistant") {
      return [];
    }

    if (Array.isArray(message.content) && message.content.some((part) => part.type !== "text")) {
      throw new Error("This runtime currently accepts text messages only.");
    }

    const content = getMessageTextContent(message);

    return content.length > 0 ? [{ role: message.role, content }] : [];
  });
}
