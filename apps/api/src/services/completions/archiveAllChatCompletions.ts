import type { ServiceContext } from "~/lib/context/serviceContext";
import { ConversationManager } from "~/lib/conversationManager";
import type { SetConversationsArchivedOptions } from "~/repositories/ConversationRepository";

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
