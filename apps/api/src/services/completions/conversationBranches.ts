import type { ConversationBranchesResponse } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { requireProjectAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";

const MAX_BRANCHES = 200;

export async function getConversationBranches(
  context: ServiceContext,
  conversationId: string,
): Promise<ConversationBranchesResponse> {
  const user = context.requireUser();
  const conversation = await context.repositories.conversations.getConversation(conversationId);

  if (!conversation || (!conversation.project_id && conversation.user_id !== user.id)) {
    throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND, 404);
  }

  const projectId = typeof conversation.project_id === "string" ? conversation.project_id : null;

  if (projectId) {
    await requireProjectAccess(context, projectId);
  }

  const rows = await context.repositories.conversations.listConversationBranches(
    conversationId,
    user.id,
    projectId,
    MAX_BRANCHES + 1,
  );
  const selected = rows.find((row) => row.id === conversationId);
  const page = rows.slice(0, MAX_BRANCHES);

  if (selected && !page.some((row) => row.id === conversationId)) {
    page[page.length - 1] = selected;
  }

  const ids = new Set(page.map((row) => row.id));

  return {
    truncated: rows.length > MAX_BRANCHES,
    branches: page.map((row) => ({
      ...row,
      parent_conversation_id:
        row.parent_conversation_id && ids.has(row.parent_conversation_id)
          ? row.parent_conversation_id
          : null,
      is_archived: Boolean(row.is_archived),
    })),
  };
}
