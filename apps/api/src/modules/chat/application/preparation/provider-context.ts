import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { toProviderMessages } from "~/modules/chat/application/messages/provider-mapping";
import { restoreStoredAttachmentContent } from "~/modules/chat/application/messages/stored-attachments";
import type { ConversationManager } from "~/modules/conversations/application/manager";
import type { Message, MessageContent } from "~/types";

import type { LatestTurn } from "./turn-context";

const logger = getLogger({ prefix: "services/chat/preparation/provider-context" });

export interface BuildProviderContextParams {
  conversationManager: ConversationManager;
  completionId?: string;
  shouldStoreMessages: boolean;
  fallbackMessages: Message[];
  latestTurn: LatestTurn;
}

function buildLatestMessageContent(
  storedContent: Message["content"],
  { text, context }: LatestTurn,
): string | MessageContent[] {
  const turnContextParts: MessageContent[] = context ? [{ type: "text", text: context }] : [];

  if (Array.isArray(storedContent)) {
    return [
      ...storedContent.map((part) => (part.type === "text" ? { ...part, text } : part)),
      ...turnContextParts,
    ];
  }

  return turnContextParts.length > 0 ? [{ type: "text", text }, ...turnContextParts] : text;
}

export function buildFinalMessages(
  sanitisedMessages: Message[],
  latestTurn: LatestTurn,
): Message[] {
  const messagesWithAttachments = restoreStoredAttachmentContent(sanitisedMessages);
  const latestIndex = messagesWithAttachments.length - 1;
  const chatMessages = messagesWithAttachments.map((msg, index) =>
    index === latestIndex
      ? {
          ...msg,
          content: buildLatestMessageContent(msg.content, latestTurn),
        }
      : msg,
  );

  return toProviderMessages(chatMessages).filter((msg) => msg.role !== "system");
}

export async function buildProviderContext({
  conversationManager,
  completionId,
  shouldStoreMessages,
  fallbackMessages,
  latestTurn,
}: BuildProviderContextParams): Promise<Message[]> {
  if (!shouldStoreMessages || !completionId) {
    return buildFinalMessages(fallbackMessages, latestTurn);
  }

  try {
    const activeMessages = await conversationManager.get(completionId);

    if (Array.isArray(activeMessages) && activeMessages.length > 0) {
      const providerMessages = buildFinalMessages(activeMessages, latestTurn);

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
