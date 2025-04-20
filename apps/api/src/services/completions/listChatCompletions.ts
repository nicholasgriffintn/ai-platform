import { ConversationManager } from "~/lib/conversationManager";
import { Database } from "~/lib/database";
import type { IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

interface ListChatCompletionsOptions {
  limit?: number;
  page?: number;
  includeArchived?: boolean;
}

export const handleListChatCompletions = async (
  req: IRequest,
  options: ListChatCompletionsOptions = {},
): Promise<{
  conversations: Record<string, unknown>[];
  totalPages: number;
  pageNumber: number;
  pageSize: number;
}> => {
  const { env, user } = req;
  const { limit = 25, page = 1, includeArchived = false } = options;

  if (!user?.id) {
    throw new AssistantError(
      "User ID is required to list conversations",
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

  return await conversationManager.list(limit, page, includeArchived);
};
