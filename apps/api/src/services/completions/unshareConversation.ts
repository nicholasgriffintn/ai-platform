import type { ServiceContext } from "~/lib/context/serviceContext";
import { ConversationManager } from "~/services/conversations/manager";

export async function handleUnshareConversation(
  context: ServiceContext,
  completion_id: string,
): Promise<{ success: boolean }> {
  const user = context.requireUser();

  context.ensureDatabase();

  const conversationManager = ConversationManager.getInstance({
    database: context.database,
    user,
  });

  await conversationManager.unshareConversation(completion_id);

  return {
    success: true,
  };
}
