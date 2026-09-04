import type { Message } from "~/types";
import { compactJsonWhitespace } from "~/utils/json";

export function compactToolOutput(message: Message): Message {
  if (
    message.role !== "tool" ||
    typeof message.content !== "string" ||
    (message.status && message.status !== "completed" && message.status !== "success")
  ) {
    return message;
  }

  const hasOtherPayload = message.parts?.some((part) => {
    if (part.type === "text") {
      return part.text !== message.content;
    }

    return (
      part.type !== "tool_result" ||
      part.content !== message.content ||
      part.toolCallId !== message.tool_call_id ||
      (part.status && part.status !== "completed" && part.status !== "success")
    );
  });

  if (hasOtherPayload) {
    return message;
  }

  const content = compactJsonWhitespace(message.content);

  if (content === message.content) {
    return message;
  }

  return {
    ...message,
    content,
    ...(message.parts
      ? {
          parts: message.parts.map((part) =>
            part.type === "text" ? { ...part, text: content } : { ...part, content },
          ),
        }
      : {}),
  };
}
