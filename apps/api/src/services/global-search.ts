import type { GlobalSearchQuery, GlobalSearchResponse } from "@ngriffin_uk/polychat-schemas";

import type { ConversationRepository } from "~/repositories/ConversationRepository";
import type {
  GlobalProjectSearchRow,
  GlobalWorkspaceSearchRow,
  WorkspaceRepository,
} from "~/repositories/WorkspaceRepository";
import { isConversationUnread } from "~/utils/conversation-organisation";
import { safeParseJson } from "~/utils/json";

export interface GlobalSearchContext {
  requireUser(): { id: number; plan_id: string | null };
  repositories: {
    conversations: Pick<ConversationRepository, "searchAccessibleConversations">;
    workspaces: Pick<WorkspaceRepository, "searchProjects" | "searchWorkspaces">;
  };
}

export async function searchPolychat(
  context: GlobalSearchContext,
  input: GlobalSearchQuery,
): Promise<GlobalSearchResponse> {
  const user = context.requireUser();
  const canSearchWork = user.plan_id === "pro";
  const [conversations, workspaces, projects] = await Promise.all([
    context.repositories.conversations.searchAccessibleConversations(
      user.id,
      input.query,
      input.limit,
    ),
    canSearchWork
      ? context.repositories.workspaces.searchWorkspaces(user.id, input.query, input.limit)
      : Promise.resolve<GlobalWorkspaceSearchRow[]>([]),
    canSearchWork
      ? context.repositories.workspaces.searchProjects(user.id, input.query, input.limit)
      : Promise.resolve<GlobalProjectSearchRow[]>([]),
  ]);

  return {
    query: input.query,
    conversations: conversations
      .filter((conversation) => canSearchWork || !conversation.project_id)
      .map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        updatedAt: conversation.updated_at,
        isPinned: conversation.is_pinned === 1,
        isUnread: isConversationUnread(conversation),
        snooze:
          conversation.snoozed_until && Date.parse(conversation.snoozed_until) > Date.now()
            ? { kind: "until" as const, until: conversation.snoozed_until }
            : conversation.snoozed_next_response_at && conversation.next_response_arrived !== 1
              ? { kind: "next_response" as const }
              : null,
        group: conversation.group
          ? safeParseJson<GlobalSearchResponse["conversations"][number]["group"]>(
              conversation.group,
            )
          : null,
        project:
          conversation.project_id &&
          conversation.project_name &&
          conversation.workspace_id &&
          conversation.workspace_name
            ? {
                id: conversation.project_id,
                name: conversation.project_name,
                workspaceId: conversation.workspace_id,
                workspaceName: conversation.workspace_name,
              }
            : null,
      })),
    workspaces: workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      updatedAt: workspace.updated_at,
    })),
    projects: projects.map((project) => ({
      id: project.id,
      workspaceId: project.workspace_id,
      workspaceName: project.workspace_name,
      name: project.name,
      description: project.description,
      updatedAt: project.updated_at,
    })),
  };
}
