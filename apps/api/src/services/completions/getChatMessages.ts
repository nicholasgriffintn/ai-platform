import { ConversationManager } from "~/lib/conversationManager";
import { Database } from "~/lib/database";
import type { AnonymousUser, User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export const handleGetChatMessages = async (
  env: any,
  user: User | null,
  anonymousUser: AnonymousUser | null,
  completion_id: string,
  limit?: number,
  after?: string,
): Promise<{ messages: any[]; conversation_id: string }> => {
  if (!user?.id) {
    throw new AssistantError(
      "User ID is required to get messages",
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
    anonymousUser,
  });

  const messages = await conversationManager.get(
    completion_id,
    undefined,
    limit || 50,
    after,
  );

  return {
    messages,
    conversation_id: completion_id,
  };
};

export const handleGetChatMessageById = async (
  env: any,
  user: User | null,
  anonymousUser: AnonymousUser | null,
  message_id: string,
): Promise<{ message: any; conversation_id: string }> => {
  if (!user?.id) {
    throw new AssistantError(
      "User ID is required to get a message",
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
    anonymousUser,
  });

  const result = await conversationManager.getMessageById(message_id);

  return result;
};
