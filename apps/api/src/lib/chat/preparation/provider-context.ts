import { toProviderMessages } from "~/lib/chat/messages/provider-mapping";
import { restoreStoredAttachmentContent } from "~/lib/chat/messages/stored-attachments";
import type { ConversationManager } from "~/lib/conversationManager";
import type { Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/chat/preparation/provider-context" });

export interface BuildProviderContextParams {
  conversationManager: ConversationManager;
  completionId?: string;
  shouldStoreMessages: boolean;
  fallbackMessages: Message[];
  messageWithContext: string;
}

export function buildFinalMessages(
  sanitisedMessages: Message[],
  messageWithContext: string,
): Message[] {
  const messagesWithAttachments = restoreStoredAttachmentContent(sanitisedMessages);

  const chatMessages = messagesWithAttachments.map((msg, index) => {
    if (index !== messagesWithAttachments.length - 1) {
      return msg;
    }

    if (Array.isArray(msg.content)) {
      return Object.assign({}, msg, {
        content: msg.content.map((part) =>
          part.type === "text" ? Object.assign({}, part, { text: messageWithContext }) : part,
        ),
      });
    }

    return Object.assign({}, msg, { content: messageWithContext });
  });

  return toProviderMessages(chatMessages).filter((msg) => msg.role !== "system");
}

export async function buildProviderContext({
  conversationManager,
  completionId,
  shouldStoreMessages,
  fallbackMessages,
  messageWithContext,
}: BuildProviderContextParams): Promise<Message[]> {
  if (!shouldStoreMessages || !completionId) {
    return buildFinalMessages(fallbackMessages, messageWithContext);
  }

  try {
    const activeMessages = await conversationManager.get(completionId);

    if (Array.isArray(activeMessages) && activeMessages.length > 0) {
      const providerMessages = buildFinalMessages(activeMessages, messageWithContext);

      if (providerMessages.length > 0) {
        return providerMessages;
      }
    }

    throw new AssistantError(
      "Stored conversation has no active messages for provider context",
      ErrorType.PARAMS_ERROR,
    );
  } catch (error) {
    logger.warn("Failed to load active conversation messages for provider context", {
      error,
      completionId,
    });
    throw error;
  }
}
