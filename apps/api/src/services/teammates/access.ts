import type { WorkspaceRole } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { Agent } from "~/lib/database/schema";
import { requireWorkspaceAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";

export type TeammateAccessAction = "read" | "write";

export const TEAMMATE_CAPABILITY_KIND = "agent";

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

export function isWorkspaceTeammate(agent: Pick<Agent, "owner_scope_type">): boolean {
  return agent.owner_scope_type === "workspace";
}

export function teammateOwnerScopeForUser(userId: number): {
  ownerScopeType: "user";
  ownerScopeId: string;
} {
  return { ownerScopeType: "user", ownerScopeId: String(userId) };
}

export async function assertTeammateAccess(
  context: ServiceContext,
  agent: Pick<Agent, "owner_scope_type" | "owner_scope_id">,
  action: TeammateAccessAction,
  userId: number,
): Promise<void> {
  if (isWorkspaceTeammate(agent)) {
    await requireWorkspaceAccess(
      context,
      agent.owner_scope_id,
      action === "write" ? TEAMMATE_WRITE_ROLES : TEAMMATE_READ_ROLES,
    );

    return;
  }

  if (agent.owner_scope_id !== String(userId)) {
    throw new AssistantError("Forbidden", ErrorType.FORBIDDEN, 403);
  }
}

async function loadTeammate(context: ServiceContext, teammateId: string): Promise<Agent> {
  const agent = await context.repositories.agents.getTeammateById(teammateId);

  if (!agent) {
    throw new AssistantError("Agent not found", ErrorType.NOT_FOUND, 404);
  }

  return agent;
}

export async function requireTeammateAccess(
  context: ServiceContext,
  teammateId: string,
  action: TeammateAccessAction,
  userId?: number,
): Promise<Agent> {
  const id = userId ?? context.requireUser().id;
  const agent = await loadTeammate(context, teammateId);

  await assertTeammateAccess(context, agent, action, id);

  return agent;
}

export async function canAccessTeammate(
  context: ServiceContext,
  agent: Pick<Agent, "owner_scope_type" | "owner_scope_id">,
  action: TeammateAccessAction,
  userId: number,
): Promise<boolean> {
  try {
    await assertTeammateAccess(context, agent, action, userId);

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
  agent: Pick<Agent, "owner_scope_type" | "owner_scope_id" | "user_id">,
  workspaceId: string,
): Promise<void> {
  if (isWorkspaceTeammate(agent)) {
    if (agent.owner_scope_id !== workspaceId) {
      throw new AssistantError("That agent belongs to another workspace", ErrorType.FORBIDDEN, 403);
    }

    return;
  }

  const membership = await context.repositories.workspaces.getMembership(
    workspaceId,
    agent.user_id,
  );

  if (!membership) {
    throw new AssistantError(
      "That agent's author is no longer a member of this workspace",
      ErrorType.FORBIDDEN,
      403,
    );
  }
}

export async function isTeammateAvailableToWorkspace(
  context: ServiceContext,
  agent: Pick<Agent, "owner_scope_type" | "owner_scope_id" | "user_id">,
  workspaceId: string,
): Promise<boolean> {
  try {
    await assertTeammateAvailableToWorkspace(context, agent, workspaceId);

    return true;
  } catch (error) {
    if (error instanceof AssistantError) {
      return false;
    }

    throw error;
  }
}
