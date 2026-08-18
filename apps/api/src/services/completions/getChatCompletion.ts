import { isAsyncInvocationPending } from "~/lib/async/asyncInvocation";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { ConversationManager } from "~/lib/conversationManager";
import { hydrateConnectorApprovalMessageState } from "~/services/apps/connectors/approval-message-state";
import type { Message } from "~/types";

import { handleAsyncInvocation } from "./async/handler";

interface GetChatCompletionOptions {
  refreshPending?: boolean;
}

function getPendingAsyncInvocation(message: Message) {
  const asyncInvocation = (message.data as Record<string, any> | undefined)?.asyncInvocation;

  return isAsyncInvocationPending(asyncInvocation) ? asyncInvocation : null;
}

async function refreshPendingMessages(
  context: ServiceContext,
  conversationManager: ConversationManager,
  completionId: string,
  messages: Message[],
  user: ReturnType<ServiceContext["requireUser"]>,
): Promise<Message[]> {
  return await Promise.all(
    messages.map(async (message) => {
      const asyncInvocation = getPendingAsyncInvocation(message);

      if (!asyncInvocation) {
        return message;
      }

      const result = await handleAsyncInvocation(asyncInvocation, message, {
        conversationManager,
        conversationId: completionId,
        env: context.env,
        user,
      });

      return result.message;
    }),
  );
}

export const handleGetChatCompletion = async (
  context: ServiceContext,
  completion_id: string,
  options: GetChatCompletionOptions = {},
): Promise<Record<string, unknown>> => {
  const user = context.requireUser();

  context.ensureDatabase();

  const conversationManager = ConversationManager.getInstance({
    database: context.database,
    user,
    env: context.env,
  });

  const conversation = await conversationManager.getConversationDetails(completion_id, {
    includeArchived: true,
    includeSnapshots: false,
  });

  if (!Array.isArray(conversation.messages)) {
    return conversation;
  }

  const refreshedMessages = options.refreshPending
    ? await refreshPendingMessages(
        context,
        conversationManager,
        completion_id,
        conversation.messages,
        user,
      )
    : conversation.messages;

  return {
    ...conversation,
    messages: await hydrateConnectorApprovalMessageState({
      messages: refreshedMessages,
      userId: user.id,
      approvals: context.repositories.connectorOperationApprovals,
    }),
  };
};
