import { DEFAULT_CONVERSATION_TITLE } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { generateConversationTitle } from "~/lib/conversation/title-generation";
import { ConversationManager } from "~/lib/conversationManager";
import type { Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

async function resolveTitleMessages(
  conversationManager: ConversationManager,
  completion_id: string,
  messages?: Message[],
): Promise<Message[]> {
  try {
    if (Array.isArray(messages) && messages.length > 0) {
      await conversationManager.getConversationMetadata(completion_id);

      return messages;
    }

    return await conversationManager.get(completion_id, undefined);
  } catch {
    throw new AssistantError(
      "Conversation not found or you don't have access to it",
      ErrorType.NOT_FOUND,
    );
  }
}

export const handleGenerateChatCompletionTitle = async (
  context: ServiceContext,
  completion_id: string,
  messages?: Message[],
  store?: boolean,
): Promise<{ title: string }> => {
  const user = context.requireUser();

  context.ensureDatabase();
  const conversationManager = ConversationManager.getInstance({
    database: context.database,
    user,
    store,
  });

  const messagesToUse = await resolveTitleMessages(conversationManager, completion_id, messages);

  if (!messagesToUse.length) {
    return { title: DEFAULT_CONVERSATION_TITLE };
  }

  const title = await generateConversationTitle(context, messagesToUse);

  await conversationManager.updateConversation(completion_id, { title });

  return { title };
};
