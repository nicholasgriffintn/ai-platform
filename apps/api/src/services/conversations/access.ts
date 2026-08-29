import type { ServiceContext } from "~/lib/context/serviceContext";
import { requireProjectAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";

/**
 * A conversation id is not proof of access. Personal conversations belong to one user;
 * project conversations are gated on workspace membership, never on the id alone.
 */
export async function requireConversationAccess(
  context: ServiceContext,
  conversationId: string,
): Promise<Record<string, unknown>> {
  const user = context.requireUser();
  const conversation = await context.repositories.conversations.getConversation(conversationId);

  if (!conversation) {
    throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND, 404);
  }

  const projectId = conversation.project_id;

  if (typeof projectId === "string" && projectId.length > 0) {
    await requireProjectAccess(context, projectId);

    return conversation;
  }

  if (conversation.user_id !== user.id) {
    throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND, 404);
  }

  return conversation;
}

export async function requireOwnConversationForWrite(
  context: ServiceContext,
  conversationId: string,
  options?: { projectId?: string },
): Promise<Record<string, unknown>> {
  const user = context.requireUser();
  const conversation = await context.repositories.conversations.getConversation(conversationId);

  if (conversation) {
    return requireConversationAccess(context, conversationId);
  }

  const projectId = options?.projectId;

  if (projectId) {
    await requireProjectAccess(context, projectId);
  }

  const created = await context.repositories.conversations.createConversation(
    conversationId,
    user.id,
    undefined,
    projectId ? { project_id: projectId } : {},
  );

  if (!created) {
    throw new AssistantError("Could not create the conversation", ErrorType.DATABASE_ERROR);
  }

  return created;
}
