import type { ServiceContext } from "~/lib/context/serviceContext";
import { ConversationManager } from "~/lib/conversationManager";
import type { ConnectorOperationApprovalRepository } from "~/repositories/ConnectorOperationApprovalRepository";
import { hydrateConnectorApprovalMessageState } from "~/services/apps/connectors/approval-message-state";
import type { AnonymousUser, Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export type GetChatMessagesContext = Pick<
  ServiceContext,
  "database" | "ensureDatabase" | "user"
> & {
  repositories: {
    connectorOperationApprovals: Pick<ConnectorOperationApprovalRepository, "getByIdsForUser">;
  };
};

export const handleGetChatMessages = async (
  context: GetChatMessagesContext,
  anonymousUser: AnonymousUser | null,
  completion_id: string,
  limit?: number,
  after?: string,
  before?: string,
): Promise<{
  messages: Message[];
  conversation_id: string;
  has_more: boolean;
  oldest_message_id: string | null;
}> => {
  const user = context.user ?? null;

  if (!user?.id) {
    throw new AssistantError("User ID is required to get messages", ErrorType.AUTHENTICATION_ERROR);
  }

  context.ensureDatabase();

  const conversationManager = ConversationManager.getInstance({
    database: context.database,
    user,
    anonymousUser,
  });

  const pageLimit = limit || 50;
  const page = before
    ? await conversationManager.getVisibleMessagesBefore(completion_id, pageLimit + 1, before, {
        includeArchived: true,
        includeSnapshots: false,
      })
    : await conversationManager.getVisibleMessages(completion_id, pageLimit + 1, after, {
        includeArchived: true,
        includeSnapshots: false,
      });
  const hasMore = page.length > pageLimit;
  const boundedPage = hasMore ? (before ? page.slice(-pageLimit) : page.slice(0, pageLimit)) : page;
  const messages = await hydrateConnectorApprovalMessageState({
    messages: boundedPage,
    userId: user.id,
    approvals: context.repositories.connectorOperationApprovals,
  });

  return {
    messages,
    conversation_id: completion_id,
    has_more: hasMore,
    oldest_message_id: messages[0]?.id ?? null,
  };
};

export const handleGetChatMessageById = async (
  context: GetChatMessagesContext,
  anonymousUser: AnonymousUser | null,
  message_id: string,
): Promise<{ message: Message; conversation_id: string }> => {
  const user = context.user ?? null;

  if (!user?.id) {
    throw new AssistantError(
      "User ID is required to get a message",
      ErrorType.AUTHENTICATION_ERROR,
    );
  }

  context.ensureDatabase();

  const conversationManager = ConversationManager.getInstance({
    database: context.database,
    user,
    anonymousUser,
  });

  const result = await conversationManager.getMessageById(message_id);
  const [message] = await hydrateConnectorApprovalMessageState({
    messages: [result.message],
    userId: user.id,
    approvals: context.repositories.connectorOperationApprovals,
  });

  return { ...result, message: message ?? result.message };
};
