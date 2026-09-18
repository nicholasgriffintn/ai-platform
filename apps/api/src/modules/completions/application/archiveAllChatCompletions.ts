import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ConversationManager } from "~/modules/conversations/application/manager";
import type { SetConversationsArchivedOptions } from "~/modules/conversations/infrastructure/ConversationRepository";

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

  return { success: true, archived };
};
