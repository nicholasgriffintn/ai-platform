import { runWithWorkspaceFunding } from "@ngriffin_uk/polychat-ai-billing";
import { authorise } from "@ngriffin_uk/polychat-library-policy";
import { usagePeriodFromDate } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { Repositories } from "~/infrastructure/database/repositories";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { WorkspacePoolRepository } from "~/modules/usage/infrastructure/WorkspacePoolRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

export interface FundedWorkScope {
  conversationId?: string | null;
  projectId?: string | null;
}

export interface WorkspaceFundingScope extends FundedWorkScope {
  userId: number;
}

async function resolveProjectId(repositories: Repositories, scope: FundedWorkScope) {
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

async function resolveFundedWorkspace(
  repositories: Repositories,
  scope: FundedWorkScope,
): Promise<string | null> {
  const projectId = await resolveProjectId(repositories, scope);

  if (!projectId) {
    return null;
  }

  const workspaceId = (await repositories.get(WorkspaceRepository).getProject(projectId))
    ?.workspace_id;

  if (!workspaceId) {
    return null;
  }

  const pool = await repositories
    .get(WorkspacePoolRepository)
    .getPool(workspaceId, usagePeriodFromDate());

  return pool ? workspaceId : null;
}

export async function resolveWorkspaceFunding(
  repositories: Repositories,
  scope: WorkspaceFundingScope,
): Promise<string | null> {
  const workspaceId = await resolveFundedWorkspace(repositories, scope);

  if (!workspaceId) {
    return null;
  }

  const membership = await repositories
    .get(WorkspaceRepository)
    .getMembership(workspaceId, scope.userId);
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

export async function withProjectFunding<T>(
  repositories: Repositories,
  scope: FundedWorkScope,
  fn: () => Promise<T>,
): Promise<T> {
  return withWorkspaceFunding(await resolveFundedWorkspace(repositories, scope), fn);
}
