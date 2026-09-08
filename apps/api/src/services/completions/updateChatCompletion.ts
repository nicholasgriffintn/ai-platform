import {
  canReplaceStoredConversationMessages,
  permissionModeSchema,
  type PermissionMode,
} from "@ngriffin_uk/polychat-schemas";

import {
  cloneMessagesForBranch,
  selectBranchSourceMessages,
} from "~/lib/chat/messages/branch-cloning";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { ConversationManager } from "~/lib/conversationManager";
import { userCreditActor } from "~/lib/usage/creditActor";
import { recordOffPlatformRunUsage } from "~/lib/usage/modelUsage";
import { withThreadLock } from "~/services/conversations/coordinator/client";
import type { Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

interface ChatCompletionUpdateParams {
  title?: string;
  archived?: boolean;
  messages?: Message[];
  parent_conversation_id?: string;
  parent_message_id?: string;
  permission_mode?: PermissionMode;
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
    env: context.env,
  });

  const { messages, parent_conversation_id, parent_message_id, ...conversationUpdates } = updates;
  const hasConversationUpdates = Object.values(conversationUpdates).some(
    (value) => value !== undefined,
  );
  let updatedConversation: Record<string, unknown> = {};

  if (messages) {
    let persistedMessages = messages;

    await withThreadLock(
      { env: context.env, conversationId: completion_id, kind: "edit_messages" },
      async (lease) => {
        const guardedConversationManager = ConversationManager.getInstance({
          database: context.database,
          repositories: context.repositories,
          user,
          env: context.env,
          writeFence: lease,
        });

        if (parent_conversation_id && parent_message_id) {
          const parentConversation = await guardedConversationManager.getConversationDetails(
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

          persistedMessages = cloneMessagesForBranch(branchSourceMessages, completion_id);
          await guardedConversationManager.replaceMessages(completion_id, persistedMessages, {
            metadata: branchMetadata,
            type: parentConversation.type === "task" ? "task" : "chat",
            permission_mode: permissionModeSchema.safeParse(parentConversation.permission_mode)
              .data,
          });
        } else {
          if (!canReplaceStoredConversationMessages(messages)) {
            throw new AssistantError(
              "Compacted visible history cannot replace stored conversation messages",
              ErrorType.PARAMS_ERROR,
              400,
            );
          }

          await guardedConversationManager.replaceMessages(completion_id, messages);
        }
      },
    );

    await Promise.all(
      persistedMessages
        .map((message) => {
          const provenance = message.provenance;

          if (
            message.role !== "assistant" ||
            !message.id ||
            !provenance ||
            provenance.site === "hosted"
          ) {
            return null;
          }

          return recordOffPlatformRunUsage({
            env: context.env,
            repositories: context.repositories,
            actor: userCreditActor(user.id),
            provenance,
            provider: message.provider,
            completionId: completion_id,
            conversationId: completion_id,
            messageId: message.id,
            runId: message.run_id,
          });
        })
        .filter((result) => result !== null),
    );

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
