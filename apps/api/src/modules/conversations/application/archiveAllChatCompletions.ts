import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ConversationManager } from "~/modules/conversations/application/manager";
import type { SetConversationsArchivedOptions } from "~/modules/conversations/infrastructure/ConversationRepository";
import { publishUserEvent } from "~/modules/sync/application/conversation-events";

export interface ArchiveAllChatCompletionsResult {
  success: boolean;
  archived: number;
}

export const handleArchiveAllChatCompletions = async (
  context: ServiceContext,
  options: SetConversationsArchivedOptions,
): Promise<ArchiveAllChatCompletionsResult> => {
  const user = context.requireUser();

  context.ensureDatabase();

  const conversationManager = ConversationManager.getInstance({
    database: context.database,
    user,
  });

  const archived = await conversationManager.setArchivedForAll(options);

  if (archived > 0) {
    publishUserEvent(context, user.id, "conversation.changed");
  }

  return { success: true, archived };
};
