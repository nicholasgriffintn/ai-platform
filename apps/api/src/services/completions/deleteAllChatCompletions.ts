import type { ConversationRepository } from "~/repositories";

interface DeleteChatCompletionResult {
  success: boolean;
  message: string;
}

export interface DeleteAllChatCompletionsContext {
  requireUser(): { id: number };
  repositories: {
    conversations: Pick<ConversationRepository, "deleteAllPersonalConversations">;
  };
}

export const handleDeleteAllChatCompletions = async (
  context: DeleteAllChatCompletionsContext,
): Promise<DeleteChatCompletionResult> => {
  const user = context.requireUser();

  await context.repositories.conversations.deleteAllPersonalConversations(user.id);

  return {
    success: true,
    message: "Conversations have been deleted",
  };
};
