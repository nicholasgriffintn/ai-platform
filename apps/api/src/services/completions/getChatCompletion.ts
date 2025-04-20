import { ConversationManager } from "~/lib/conversationManager";
import { Database } from "~/lib/database";
import type { IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export const handleGetChatCompletion = async (
  req: IRequest,
  completion_id: string,
): Promise<Record<string, unknown>> => {
  const { env, user } = req;

  if (!user?.id) {
    throw new AssistantError(
      "User ID is required to get a conversation",
      ErrorType.AUTHENTICATION_ERROR,
    );
  }

  if (!env.DB) {
    throw new AssistantError(
      "Missing database connection",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const database = Database.getInstance(env);

  const conversationManager = ConversationManager.getInstance({
    database,
    userId: user.id,
  });

  const conversation =
    await conversationManager.getConversationDetails(completion_id);
  return conversation;
};
