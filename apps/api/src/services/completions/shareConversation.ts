import type { ServiceContext } from "~/lib/context/serviceContext";
import { ConversationManager } from "~/lib/conversationManager";
import { assertConversationNotLocked } from "~/services/conversations/lock";

export async function handleShareConversation(
  context: ServiceContext,
  completion_id: string,
): Promise<{ share_id: string }> {
  const user = context.requireUser();

  context.ensureDatabase();

  await assertConversationNotLocked(context, completion_id, "Sharing");

  const conversationManager = ConversationManager.getInstance({
    database: context.database,
    user,
  });

  const result = await conversationManager.shareConversation(completion_id);

  return {
    share_id: result.share_id,
  };
}
