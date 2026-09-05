import { isAsyncInvocationPending } from "~/lib/async/asyncInvocation";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { ConversationManager } from "~/lib/conversationManager";
import { hydrateConnectorApprovalMessageState } from "~/services/apps/connectors/approval-message-state";
import { hydrateChatRunUsage } from "~/services/chat-runs/usage";
import {
  getActiveThreadOperation,
  withThreadLockIfFree,
} from "~/services/conversations/coordinator/client";
import type { Message } from "~/types";

import { handleAsyncInvocation } from "./async/handler";

interface GetChatCompletionOptions {
  refreshPending?: boolean;
  messageLimit?: number;
}

async function refreshPendingMessages(
  context: ServiceContext,
  completionId: string,
  messages: Message[],
  user: ReturnType<ServiceContext["requireUser"]>,
): Promise<Message[]> {
  const refreshed = await withThreadLockIfFree(
    { env: context.env, conversationId: completionId, kind: "async_result" },
    (lease) => {
      const conversationManager = ConversationManager.getInstance({
        database: context.database,
        repositories: context.repositories,
        user,
        env: context.env,
        writeFence: lease,
      });

      return Promise.all(
        messages.map(async (message) => {
          const asyncInvocation = message.data?.asyncInvocation;

          if (!isAsyncInvocationPending(asyncInvocation)) {
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
    },
  );

  return refreshed ?? messages;
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

  await conversationManager.getConversationMetadata(completion_id);
  const activeOperation = await getActiveThreadOperation({
    env: context.env,
    conversationId: completion_id,
  });
  const latestRunRecord =
    await context.repositories.conversationRuns.getLatestForConversation(completion_id);
  const [latestRun] = latestRunRecord
    ? await hydrateChatRunUsage(context.repositories, [latestRunRecord])
    : [null];

  const conversation = await conversationManager.getConversationDetails(completion_id, {
    includeArchived: true,
    includeSnapshots: false,
    messageLimit: options.messageLimit,
  });

  if (!Array.isArray(conversation.messages)) {
    return {
      ...conversation,
      active_operation: activeOperation,
      latest_run: latestRun,
    };
  }

  const refreshedMessages = options.refreshPending
    ? await refreshPendingMessages(context, completion_id, conversation.messages, user)
    : conversation.messages;

  return {
    ...conversation,
    active_operation: activeOperation,
    latest_run: latestRun,
    messages: await hydrateConnectorApprovalMessageState({
      messages: refreshedMessages,
      userId: user.id,
      approvals: context.repositories.connectorOperationApprovals,
    }),
  };
};
