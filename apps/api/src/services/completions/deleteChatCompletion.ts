import type { ServiceContext } from "~/lib/context/serviceContext";
import { ConversationManager } from "~/lib/conversationManager";
import { conversationAudience } from "~/services/sync/audience";
import { publishConversationDeleted } from "~/services/sync/conversation-events";

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

  await publishConversationDeleted(context.env, completion_id, audience);

  return {
    success: true,
    message: "Conversation has been archived",
  };
};
