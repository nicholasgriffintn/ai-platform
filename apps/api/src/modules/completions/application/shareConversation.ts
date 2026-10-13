import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ConversationManager } from "~/modules/conversations/application/manager";
import type { ConversationShare } from "~/modules/conversations/application/sharing";

export async function handleShareConversation(
  context: ServiceContext,
  completion_id: string,
): Promise<ConversationShare> {
  const user = context.requireUser();

  context.ensureDatabase();

  const conversationManager = ConversationManager.getInstance({
    database: context.database,
    user,
  });

  return conversationManager.shareConversation(completion_id);
}
