import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ConversationManager } from "~/modules/conversations/application/manager";
import { toProviderMessages } from "~/modules/responses/application/engine/messages/provider-mapping";
import { restoreStoredAttachmentContent } from "~/modules/responses/application/engine/messages/stored-attachments";
import type { Message, MessageContent } from "~/types";

import type { LatestTurn } from "./turn-context";

const logger = getLogger({ prefix: "services/chat/preparation/provider-context" });

export interface LoadActiveMessagesParams {
  conversationManager: ConversationManager;
  completionId?: string;
  shouldStoreMessages: boolean;
}

export interface BuildProviderContextParams {
  activeMessages: Message[] | null;
  completionId?: string;
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

export async function loadActiveMessages({
  conversationManager,
  completionId,
  shouldStoreMessages,
}: LoadActiveMessagesParams): Promise<Message[] | null> {
  if (!shouldStoreMessages || !completionId) {
    return null;
  }

  try {
    return await conversationManager.get(completionId);
  } catch (error) {
    logger.warn("Failed to load active conversation messages for provider context", {
      error,
      completionId,
    });
    throw error;
  }
}

export function buildProviderContext({
  activeMessages,
  completionId,
  fallbackMessages,
  latestTurn,
}: BuildProviderContextParams): Message[] {
  if (activeMessages === null) {
    return buildFinalMessages(fallbackMessages, latestTurn);
  }

  const providerMessages =
    activeMessages.length > 0 ? buildFinalMessages(activeMessages, latestTurn) : [];

  if (providerMessages.length > 0) {
    return providerMessages;
  }

  logger.warn("Stored conversation has no active messages for provider context", { completionId });

  throw new AssistantError(
    "Stored conversation has no active messages for provider context",
    ErrorType.PARAMS_ERROR,
  );
}
