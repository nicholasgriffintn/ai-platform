import { ConversationManager } from "~/lib/conversationManager";
import { Database } from "~/lib/database";
import { refreshAsyncMessages } from "~/services/completions/refreshAsyncMessages";
import type { IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export const handleGetChatCompletion = async (
  req: IRequest,
  completion_id: string,
  options?: { refreshPending?: boolean },
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
    user,
  });

  let conversation =
    await conversationManager.getConversationDetails(completion_id);

  if (options?.refreshPending) {
    const messages = (conversation.messages as any[]) || [];
    const refreshedMessages = await refreshAsyncMessages({
      conversationManager,
      conversationId: completion_id,
      env,
      user,
      messages,
    });

    conversation = {
      ...conversation,
      messages: refreshedMessages,
    };
  }

  return conversation;
};
