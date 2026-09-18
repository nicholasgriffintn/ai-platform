import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { hasSnapshotPart } from "~/modules/chat/application/messages/parts";
import { formatStoredMessage } from "~/modules/conversations/application/stored-message";
import { loadVisibleConversationMessagePage } from "~/modules/conversations/domain/visibleMessagePagination";
import type { Message, User } from "~/types";

export interface ConversationSharingScope {
  repositories: RepositoryManager;
  user?: User | null;
  canAccessConversation(conversation: Record<string, unknown>): Promise<boolean>;
  assertWriteOwnership(): Promise<void>;
}

async function loadOwnedConversation(
  scope: ConversationSharingScope,
  conversationId: string,
  action: "share" | "unshare",
): Promise<Record<string, unknown>> {
  if (!scope.user?.id) {
    throw new AssistantError(
      `User ID is required to ${action} conversations`,
      ErrorType.AUTHENTICATION_ERROR,
    );
  }

  const conversation = await scope.repositories.conversations.getConversation(conversationId);

  if (!conversation) {
    throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND);
  }

  if (!(await scope.canAccessConversation(conversation))) {
    throw new AssistantError(
      `You don't have permission to ${action} this conversation`,
      ErrorType.FORBIDDEN,
    );
  }

  return conversation;
}

export async function shareConversation(
  scope: ConversationSharingScope,
  conversationId: string,
): Promise<{ share_id: string }> {
  const conversation = await loadOwnedConversation(scope, conversationId, "share");

  if (conversation.project_id) {
    throw new AssistantError(
      "Project conversations cannot be shared publicly",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  const share_id =
    typeof conversation.share_id === "string" && conversation.share_id
      ? conversation.share_id
      : generateId();

  await scope.assertWriteOwnership();
  const updated = await scope.repositories.conversations.updateConversation(conversationId, {
    is_public: 1,
    share_id,
  });

  if (!updated) {
    throw new AssistantError("Failed to share conversation", ErrorType.UNKNOWN_ERROR);
  }

  return { share_id };
}

export async function unshareConversation(
  scope: ConversationSharingScope,
  conversationId: string,
): Promise<void> {
  await loadOwnedConversation(scope, conversationId, "unshare");
  await scope.assertWriteOwnership();
  const updated = await scope.repositories.conversations.updateConversation(conversationId, {
    is_public: 0,
  });

  if (!updated) {
    throw new AssistantError("Failed to unshare conversation", ErrorType.UNKNOWN_ERROR);
  }
}

export async function getPublicConversation(
  repositories: RepositoryManager,
  shareId: string,
  limit = 50,
  after?: string,
  options?: { includeArchived?: boolean },
): Promise<Message[]> {
  const conversation = await repositories.conversations.getConversationByShareId(shareId);

  if (!conversation || conversation.project_id) {
    throw new AssistantError("Shared conversation not found", ErrorType.NOT_FOUND);
  }

  if (!conversation.is_public) {
    throw new AssistantError("This conversation is not publicly shared", ErrorType.FORBIDDEN);
  }

  if (typeof conversation.id !== "string") {
    throw new AssistantError("Shared conversation not found", ErrorType.NOT_FOUND);
  }

  return loadVisibleConversationMessagePage({
    conversationId: conversation.id,
    limit,
    after,
    includeArchived: options?.includeArchived ?? false,
    loadMessages: (conversationId, pageLimit, cursor, pageOptions) =>
      repositories.messages.getMessages(conversationId, pageLimit, cursor, pageOptions),
    formatMessage: formatStoredMessage,
    isHiddenMessage: hasSnapshotPart,
  });
}
