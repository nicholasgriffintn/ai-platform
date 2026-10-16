import type { Repositories } from "~/infrastructure/database/repositories";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";

interface DeleteChatCompletionResult {
  success: boolean;
  message: string;
}

export interface DeleteAllChatCompletionsContext {
  requireUser(): { id: number };
  repositories: Repositories;
}

export const handleDeleteAllChatCompletions = async (
  context: DeleteAllChatCompletionsContext,
): Promise<DeleteChatCompletionResult> => {
  const user = context.requireUser();

  await context.repositories.get(ConversationRepository).deleteAllPersonalConversations(user.id);

  return {
    success: true,
    message: "Conversations have been deleted",
  };
};
