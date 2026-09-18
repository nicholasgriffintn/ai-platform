import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ConversationManager } from "~/modules/conversations/application/manager";

export async function handleShareConversation(
  context: ServiceContext,
  completion_id: string,
): Promise<{ share_id: string }> {
  const user = context.requireUser();

  context.ensureDatabase();

  const conversationManager = ConversationManager.getInstance({
    database: context.database,
    user,
  });

  const result = await conversationManager.shareConversation(completion_id);

  return {
    share_id: result.share_id,
  };
}
