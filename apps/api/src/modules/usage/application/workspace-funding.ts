import { runWithWorkspaceFunding } from "@ngriffin_uk/polychat-ai-billing";
import { authorise } from "@ngriffin_uk/polychat-library-policy";
import { usagePeriodFromDate } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { Repositories } from "~/infrastructure/database/repositories";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { WorkspacePoolRepository } from "~/modules/usage/infrastructure/WorkspacePoolRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

export interface WorkspaceFundingScope {
  userId: number;
  conversationId?: string | null;
  projectId?: string | null;
}

async function resolveProjectId(repositories: Repositories, scope: WorkspaceFundingScope) {
  if (!scope.conversationId) {
    return scope.projectId ?? null;
  }

  const conversation = await repositories
    .get(ConversationRepository)
    .getConversation(scope.conversationId);

  if (conversation) {
    return typeof conversation.project_id === "string" ? conversation.project_id : null;
  }

  return scope.projectId ?? null;
}

export async function resolveWorkspaceFunding(
  repositories: Repositories,
  scope: WorkspaceFundingScope,
): Promise<string | null> {
  const projectId = await resolveProjectId(repositories, scope);

  if (!projectId) {
    return null;
  }

  const workspaces = repositories.get(WorkspaceRepository);
  const workspaceId = (await workspaces.getProject(projectId))?.workspace_id;

  if (!workspaceId) {
    return null;
  }

  const [pool, membership] = await Promise.all([
    repositories.get(WorkspacePoolRepository).getPool(workspaceId, usagePeriodFromDate()),
    workspaces.getMembership(workspaceId, scope.userId),
  ]);

  if (!pool) {
    return null;
  }

  const decision = authorise("workspace.pool.draw", {
    pooled: true,
    member: Boolean(membership),
    role: membership?.role ?? "",
  });

  if (!decision.allowed) {
    throw new AssistantError(
      "A seat in this workspace is required to use its shared credits",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  return workspaceId;
}

export function withWorkspaceFunding<T>(workspaceId: string | null, fn: () => T): T {
  return workspaceId ? runWithWorkspaceFunding(workspaceId, fn) : fn();
}
