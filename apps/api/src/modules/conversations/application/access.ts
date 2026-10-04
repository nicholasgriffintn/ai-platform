import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

export async function requireConversationAccess(
  context: ServiceContext,
  conversationId: string,
): Promise<Record<string, unknown>> {
  const user = context.requireUser();
  const conversation = await context.repositories.conversations.getConversation(conversationId);

  if (!conversation) {
    throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND, 404);
  }

  const teammateContext =
    await context.repositories.teammateContexts.getByHomeConversationId(conversationId);

  if (teammateContext && !ownsResource(user.id, teammateContext.actorUserId)) {
    throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND, 404);
  }

  const projectId = conversation.project_id;

  if (typeof projectId === "string" && projectId.length > 0) {
    await requireProjectAccess(context, projectId);

    return conversation;
  }

  if (!ownsResource(user.id, conversation.user_id)) {
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
