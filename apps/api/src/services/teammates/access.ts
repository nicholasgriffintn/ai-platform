import type { WorkspaceRole } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { Teammate } from "~/lib/database/schema";
import { requireWorkspaceAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";

export type TeammateAccessAction = "read" | "write";

export const TEAMMATE_CAPABILITY_KIND = "teammate";

interface ProjectCapabilityGrant {
  kind: string;
  capability_id: string;
}

export function resolveProjectTeammateGrants(
  capabilities: readonly ProjectCapabilityGrant[],
): string[] {
  return capabilities
    .filter((capability) => capability.kind === TEAMMATE_CAPABILITY_KIND)
    .map((capability) => capability.capability_id);
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
