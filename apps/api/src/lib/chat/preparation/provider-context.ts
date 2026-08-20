import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

import { toProviderMessages } from "~/lib/chat/messages/provider-mapping";
import { restoreStoredAttachmentContent } from "~/lib/chat/messages/stored-attachments";
import { pruneMessagesToFitContext } from "~/lib/chat/policy/context-window";
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
  primaryModelConfig: ModelConfigItem;
}

/**
 * The final user turn carries the attachment-expanded text, so the last message's
 * text is replaced rather than appended. System turns are dropped because the
 * system prompt is passed to the provider separately.
 */
export function buildFinalMessages(
  sanitisedMessages: Message[],
  messageWithContext: string,
  modelConfig: ModelConfigItem,
): Message[] {
  const messagesWithAttachments = restoreStoredAttachmentContent(sanitisedMessages);
  const prunedWithAttachments =
    messagesWithAttachments.length > 0
      ? pruneMessagesToFitContext(messagesWithAttachments, messageWithContext, modelConfig)
      : [];

  const chatMessages = prunedWithAttachments.map((msg, index) => {
    if (index !== prunedWithAttachments.length - 1) {
      return msg;
    }

    if (Array.isArray(msg.content)) {
      return {
        ...msg,
        content: msg.content.map((part) =>
          part.type === "text" ? { ...part, text: messageWithContext } : part,
        ),
      };
    }

    return { ...msg, content: messageWithContext };
  });

  return toProviderMessages(chatMessages).filter((msg) => msg.role !== "system");
}

export async function buildProviderContext({
  conversationManager,
  completionId,
  shouldStoreMessages,
  fallbackMessages,
  messageWithContext,
  primaryModelConfig,
}: BuildProviderContextParams): Promise<Message[]> {
  if (!shouldStoreMessages || !completionId) {
    return buildFinalMessages(fallbackMessages, messageWithContext, primaryModelConfig);
  }

  try {
    const activeMessages = await conversationManager.get(completionId);

    if (Array.isArray(activeMessages) && activeMessages.length > 0) {
      const providerMessages = buildFinalMessages(
        activeMessages,
        messageWithContext,
        primaryModelConfig,
      );

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
