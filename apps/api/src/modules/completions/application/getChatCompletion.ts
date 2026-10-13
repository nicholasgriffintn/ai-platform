import { isAsyncInvocationPending } from "@ngriffin_uk/polychat-ai-providers";
import { settleWithin } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { hydrateConnectorApprovalMessageState } from "~/modules/apps/application/connectors/approval-message-state";
import { hydrateDelegatedUsage } from "~/modules/chat-runs/application/delegated-usage";
import { hydrateChatRunUsage } from "~/modules/chat-runs/application/usage";
import { ConversationManager } from "~/modules/conversations/application/manager";
import {
  getActiveThreadOperation,
  withThreadLockIfFree,
} from "~/modules/conversations/infrastructure/coordinator/client";
import type { Message } from "~/types";

import { handleAsyncInvocation } from "./async/handler";

const ACTIVE_OPERATION_WAIT_MS = 250;

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
  if (!messages.some((message) => isAsyncInvocationPending(message.data?.asyncInvocation))) {
    return messages;
  }

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

async function loadConversationMessages(
  context: ServiceContext,
  conversationManager: ConversationManager,
  conversation: Record<string, unknown>,
  user: ReturnType<ServiceContext["requireUser"]>,
  options: GetChatCompletionOptions,
) {
  const page = await conversationManager.getAuthorisedConversationMessages(conversation, {
    includeArchived: true,
    includeSnapshots: false,
    messageLimit: options.messageLimit,
  });
  const completionId = String(conversation.id);
  const messages = options.refreshPending
    ? await refreshPendingMessages(context, completionId, page.messages, user)
    : page.messages;

  return {
    ...page,
    messages: await hydrateConnectorApprovalMessageState({
      messages,
      userId: user.id,
      approvals: context.repositories.connectorOperationApprovals,
    }),
  };
}

async function loadActiveOperation(context: ServiceContext, completionId: string) {
  const status = getActiveThreadOperation({ env: context.env, conversationId: completionId });

  context.waitUntil(status.catch(() => undefined));

  return settleWithin(status, ACTIVE_OPERATION_WAIT_MS, undefined);
}

async function loadLatestRun(context: ServiceContext, completionId: string) {
  const latestRunRecord =
    await context.repositories.conversationRuns.getLatestForConversation(completionId);

  if (!latestRunRecord) {
    return null;
  }

  const [latestRun] = await hydrateChatRunUsage(context.repositories, [latestRunRecord]);

  return latestRun ? hydrateDelegatedUsage(context, latestRun) : null;
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

  const conversation = await conversationManager.getConversationMetadata(completion_id);
  const [details, activeOperation, latestRun, family] = await Promise.all([
    loadConversationMessages(context, conversationManager, conversation, user, options),
    loadActiveOperation(context, completion_id),
    loadLatestRun(context, completion_id),
    context.repositories.conversations.listConversationThreads(
      completion_id,
      user.id,
      typeof conversation.project_id === "string" ? conversation.project_id : null,
      2,
    ),
  ]);

  return {
    ...conversation,
    ...details,
    is_archived: Boolean(conversation.is_archived),
    active_operation: activeOperation,
    latest_run: latestRun,
    has_branches: family.length > 1,
  };
};
