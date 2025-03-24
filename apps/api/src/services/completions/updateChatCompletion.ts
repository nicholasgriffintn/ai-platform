import { ConversationManager } from "../../lib/conversationManager";
import type { IRequest } from "../../types";
import { AssistantError, ErrorType } from "../../utils/errors";

interface ChatCompletionUpdateParams {
  title?: string;
  archived?: boolean;
}

export const handleUpdateChatCompletion = async (
  req: IRequest,
  completion_id: string,
  updates: ChatCompletionUpdateParams,
): Promise<Record<string, unknown>> => {
  const { env, user } = req;

  if (!user?.id) {
    throw new AssistantError(
      "User ID is required to update a conversation",
      ErrorType.AUTHENTICATION_ERROR,
    );
  }

  if (!env.DB) {
    throw new AssistantError(
      "Missing database connection",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const conversationManager = ConversationManager.getInstance({
    database: env.DB,
    userId: user.id,
  });

  const updatedConversation = await conversationManager.updateConversation(
    completion_id,
    updates,
  );
  return updatedConversation;
};
