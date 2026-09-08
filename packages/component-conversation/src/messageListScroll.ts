import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { getMessageTextContent } from "@ngriffin_uk/polychat-library-chat/messages";

type MessageListScrollMessage = Pick<Message, "id" | "content" | "parts" | "reasoning">;

interface MessageListScrollKeyInput {
  conversationId?: string;
  messages: MessageListScrollMessage[];
}

export function getMessageListScrollKey({
  conversationId,
  messages,
}: MessageListScrollKeyInput): string {
  const conversationKey = conversationId ?? "new";
  const lastMessage = messages[messages.length - 1];

  if (!lastMessage) {
    return `${conversationKey}:empty`;
  }

  const streamedLength =
    getMessageTextContent(lastMessage).length + (lastMessage.reasoning?.content.length ?? 0);

  return `${conversationKey}:${messages.length}:${lastMessage.id}:${streamedLength}`;
}
