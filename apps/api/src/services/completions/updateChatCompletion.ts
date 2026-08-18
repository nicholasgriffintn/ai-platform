import { canReplaceStoredConversationMessages } from "@ngriffin_uk/polychat-schemas";

import { cloneMessagesForBranch, selectBranchSourceMessages } from "~/lib/chat/branchMessages";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { ConversationManager } from "~/lib/conversationManager";
import type { Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

interface ChatCompletionUpdateParams {
  title?: string;
  archived?: boolean;
  messages?: Message[];
  parent_conversation_id?: string;
  parent_message_id?: string;
}

export const handleUpdateChatCompletion = async (
  context: ServiceContext,
  completion_id: string,
  updates: ChatCompletionUpdateParams,
): Promise<Record<string, unknown>> => {
  const user = context.requireUser();

  context.ensureDatabase();

  const conversationManager = ConversationManager.getInstance({
    database: context.database,
    user,
  });

  const { messages, parent_conversation_id, parent_message_id, ...conversationUpdates } = updates;
  const hasConversationUpdates = Object.values(conversationUpdates).some(
    (value) => value !== undefined,
  );
  let updatedConversation: Record<string, unknown> = {};

  if (messages) {
    if (parent_conversation_id && parent_message_id) {
      const parentConversation = await conversationManager.getConversationDetails(
        parent_conversation_id,
        { includeArchived: false, includeSnapshots: true },
      );
      const branchSourceMessages = selectBranchSourceMessages({
        parentActiveMessages: parentConversation.messages,
        parentMessageId: parent_message_id,
        providedMessages: messages,
      });
      const branchMetadata = {
        branch_of: JSON.stringify({
          conversation_id: parent_conversation_id,
          message_id: parent_message_id,
        }),
        ...(typeof parentConversation.project_id === "string"
          ? { project_id: parentConversation.project_id }
          : {}),
      };

      if (!canReplaceStoredConversationMessages(branchSourceMessages)) {
        throw new AssistantError(
          "Compacted visible history cannot be used to create a stored branch",
          ErrorType.PARAMS_ERROR,
          400,
        );
      }

      await conversationManager.replaceMessages(
        completion_id,
        cloneMessagesForBranch(branchSourceMessages, completion_id),
        {
          metadata: branchMetadata,
        },
      );
    } else {
      if (!canReplaceStoredConversationMessages(messages)) {
        throw new AssistantError(
          "Compacted visible history cannot replace stored conversation messages",
          ErrorType.PARAMS_ERROR,
          400,
        );
      }

      await conversationManager.replaceMessages(completion_id, messages);
    }

    updatedConversation = await conversationManager.getConversationDetails(completion_id);
  }

  if (hasConversationUpdates) {
    updatedConversation = await conversationManager.updateConversation(
      completion_id,
      conversationUpdates,
    );
  }

  if (messages) {
    updatedConversation = await conversationManager.getConversationDetails(completion_id);
  }

  return updatedConversation;
};
