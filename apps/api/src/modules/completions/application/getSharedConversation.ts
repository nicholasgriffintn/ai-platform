import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ConversationManager } from "~/modules/conversations/application/manager";
import type { Message } from "~/types";

export async function handleGetSharedConversation(
  context: ServiceContext,
  share_id: string,
  limit = 50,
  after?: string,
): Promise<{ messages: Message[]; share_id: string; shared_through: number | null }> {
  context.ensureDatabase();

  const conversationManager = ConversationManager.getInstance({
    database: context.database,
    env: context.env,
  });

  const page = await conversationManager.getPublicConversation(share_id, limit, after, {
    includeArchived: true,
  });

  return {
    messages: page.messages,
    share_id,
    shared_through: page.sharedThrough,
  };
}
