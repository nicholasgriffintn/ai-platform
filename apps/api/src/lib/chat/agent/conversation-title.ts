import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ConversationManager } from "~/lib/conversationManager";
import { handleGenerateChatCompletionTitle } from "~/services/completions/generateChatCompletionTitle";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/chat/agent/conversation-title" });

const UNTITLED = new Set(["", "new conversation", "untitled"]);

export interface EnsureConversationTitleParams {
  completionId: string;
  conversationManager: ConversationManager;
  context?: ServiceContext;
  store?: boolean;
}

export async function ensureConversationTitle(
  params: EnsureConversationTitleParams,
): Promise<string | null> {
  if (!params.context?.user?.id || params.store === false || !params.completionId) {
    return null;
  }

  try {
    const details = await params.conversationManager.getConversationDetails(params.completionId);
    const existing = typeof details?.title === "string" ? details.title : "";

    if (!UNTITLED.has(existing.trim().toLowerCase())) {
      return null;
    }

    const { title } = await handleGenerateChatCompletionTitle(
      params.context,
      params.completionId,
      undefined,
      params.store,
    );

    return title || null;
  } catch (error) {
    logger.warn("Failed to title the conversation", {
      error,
      completionId: params.completionId,
    });

    return null;
  }
}
