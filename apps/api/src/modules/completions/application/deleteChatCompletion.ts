import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ConversationManager } from "~/modules/conversations/application/manager";
import { conversationAudience } from "~/modules/sync/application/audience";
import { publishConversationDeleted } from "~/modules/sync/application/conversation-events";

interface DeleteChatCompletionResult {
  success: boolean;
  message: string;
}

export const handleDeleteChatCompletion = async (
  context: ServiceContext,
  completion_id: string,
): Promise<DeleteChatCompletionResult> => {
  const user = context.requireUser();

  context.ensureDatabase();

  const conversationManager = ConversationManager.getInstance({
    database: context.database,
    user,
  });

  const audience = await conversationAudience(context.env, completion_id);

  await conversationManager.updateConversation(completion_id, {
    archived: true,
  });

  publishConversationDeleted(context, completion_id, audience);

  return {
    success: true,
    message: "Conversation has been archived",
  };
};
