import type { WorkspaceRole } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { Teammate } from "~/lib/database/schema";
import { requireProjectAccess, requireWorkspaceAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";

export type TeammateAccessAction = "read" | "write";

export const TEAMMATE_CAPABILITY_KIND = "teammate";

interface ProjectCapabilityGrant {
  kind: string;
  capability_id: string;
  excluded?: boolean;
}

export function resolveProjectTeammateGrants(
  capabilities: readonly ProjectCapabilityGrant[],
): string[] {
  return capabilities
    .filter((capability) => capability.kind === TEAMMATE_CAPABILITY_KIND && !capability.excluded)
    .map((capability) => capability.capability_id);
}

export function resolveRemovedProjectTeammates(
  capabilities: readonly ProjectCapabilityGrant[],
): Set<string> {
  return new Set(
    capabilities
      .filter((capability) => capability.kind === TEAMMATE_CAPABILITY_KIND && capability.excluded)
      .map((capability) => capability.capability_id),
  );
}

/**
 * A workspace default reaches every project in that workspace unless the project removed it,
 * so adding a teammate once does not mean adding it to each project by hand.
 */
export function resolveProjectTeammateIds(params: {
  capabilities: readonly ProjectCapabilityGrant[];
  workspaceDefaultTeammateIds: readonly string[];
}): string[] {
  const removed = resolveRemovedProjectTeammates(params.capabilities);
  const granted = resolveProjectTeammateGrants(params.capabilities);
  const inherited = params.workspaceDefaultTeammateIds.filter((id) => !removed.has(id));

  return [...new Set([...granted, ...inherited])];
}

const TEAMMATE_READ_ROLES: readonly WorkspaceRole[] = ["owner", "admin", "member"];
const TEAMMATE_WRITE_ROLES: readonly WorkspaceRole[] = ["owner", "admin"];

export function isWorkspaceTeammate(teammate: Pick<Teammate, "owner_scope_type">): boolean {
  return teammate.owner_scope_type === "workspace";
}

export function teammateOwnerScopeForUser(userId: number): {
  ownerScopeType: "user";
  ownerScopeId: string;
} {
  return { ownerScopeType: "user", ownerScopeId: String(userId) };
}

export async function assertTeammateAccess(
  context: ServiceContext,
  teammate: Pick<Teammate, "owner_scope_type" | "owner_scope_id">,
  action: TeammateAccessAction,
  userId: number,
): Promise<void> {
  if (isWorkspaceTeammate(teammate)) {
    await requireWorkspaceAccess(
      context,
      teammate.owner_scope_id,
      action === "write" ? TEAMMATE_WRITE_ROLES : TEAMMATE_READ_ROLES,
    );

    return;
  }

  if (teammate.owner_scope_id !== String(userId)) {
    throw new AssistantError("Forbidden", ErrorType.FORBIDDEN, 403);
  }
}

async function loadTeammate(context: ServiceContext, teammateId: string): Promise<Teammate> {
  const teammate = await context.repositories.teammates.getTeammateById(teammateId);

  if (!teammate) {
    throw new AssistantError("Teammate not found", ErrorType.NOT_FOUND, 404);
  }

  return teammate;
}

export async function requireTeammateAccess(
  context: ServiceContext,
  teammateId: string,
  action: TeammateAccessAction,
  userId?: number,
): Promise<Teammate> {
  const id = userId ?? context.requireUser().id;
  const teammate = await loadTeammate(context, teammateId);

  await assertTeammateAccess(context, teammate, action, id);

  return teammate;
}

export async function requireProjectTeammate(
  context: ServiceContext,
  projectId: string,
  teammateId: string,
): Promise<Teammate> {
  const { project } = await requireProjectAccess(context, projectId);
  const [capabilities, workspaceDefaults, teammate] = await Promise.all([
    context.repositories.workspaces.listProjectCapabilities(projectId),
    context.repositories.teammates.listWorkspaceDefaults(project.workspace_id),
    loadTeammate(context, teammateId),
  ]);
  const availableIds = resolveProjectTeammateIds({
    capabilities,
    workspaceDefaultTeammateIds: workspaceDefaults.map((candidate) => candidate.id),
  });

  if (!availableIds.includes(teammateId)) {
    throw new AssistantError(
      "That teammate is not available in this project",
      ErrorType.NOT_FOUND,
      404,
    );
  }

  await assertTeammateAvailableToWorkspace(context, teammate, project.workspace_id);

  return teammate;
}

export async function requireScopedTeammateAccess(
  context: ServiceContext,
  teammateId: string,
  scope: { type: "personal"; id: string } | { type: "project"; id: string },
  userId?: number,
): Promise<Teammate> {
  if (scope.type === "project") {
    return requireProjectTeammate(context, scope.id, teammateId);
  }

  return requireTeammateAccess(context, teammateId, "read", userId);
}

export async function canAccessTeammate(
  context: ServiceContext,
  teammate: Pick<Teammate, "owner_scope_type" | "owner_scope_id">,
  action: TeammateAccessAction,
  userId: number,
): Promise<boolean> {
  try {
    await assertTeammateAccess(context, teammate, action, userId);

    return true;
  } catch (error) {
    if (error instanceof AssistantError) {
      return false;
    }

    throw error;
  }
}

export async function assertTeammateAvailableToWorkspace(
  context: ServiceContext,
  teammate: Pick<Teammate, "owner_scope_type" | "owner_scope_id" | "user_id">,
  workspaceId: string,
): Promise<void> {
  if (isWorkspaceTeammate(teammate)) {
    if (teammate.owner_scope_id !== workspaceId) {
      throw new AssistantError(
        "That teammate belongs to another workspace",
        ErrorType.FORBIDDEN,
        403,
      );
    }

    return;
  }

  const membership = await context.repositories.workspaces.getMembership(
    workspaceId,
    teammate.user_id,
  );

  if (!membership) {
    throw new AssistantError(
      "That teammate's author is no longer a member of this workspace",
      ErrorType.FORBIDDEN,
      403,
    );
  }
}

export async function isTeammateAvailableToWorkspace(
  context: ServiceContext,
  teammate: Pick<Teammate, "owner_scope_type" | "owner_scope_id" | "user_id">,
  workspaceId: string,
): Promise<boolean> {
  try {
    await assertTeammateAvailableToWorkspace(context, teammate, workspaceId);

    return true;
  } catch (error) {
    if (error instanceof AssistantError) {
      return false;
    }

    throw error;
  }
}
