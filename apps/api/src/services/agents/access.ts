import type { WorkspaceRole } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { Agent } from "~/lib/database/schema";
import { requireWorkspaceAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";

export type AgentAccessAction = "read" | "write";

const AGENT_READ_ROLES: readonly WorkspaceRole[] = ["owner", "admin", "member"];
const AGENT_WRITE_ROLES: readonly WorkspaceRole[] = ["owner", "admin"];

export function isWorkspaceAgent(agent: Pick<Agent, "owner_scope_type">): boolean {
  return agent.owner_scope_type === "workspace";
}

export function agentOwnerScopeForUser(userId: number): {
  ownerScopeType: "user";
  ownerScopeId: string;
} {
  return { ownerScopeType: "user", ownerScopeId: String(userId) };
}

export async function assertAgentAccess(
  context: ServiceContext,
  agent: Pick<Agent, "owner_scope_type" | "owner_scope_id">,
  action: AgentAccessAction,
  userId: number,
): Promise<void> {
  if (isWorkspaceAgent(agent)) {
    await requireWorkspaceAccess(
      context,
      agent.owner_scope_id,
      action === "write" ? AGENT_WRITE_ROLES : AGENT_READ_ROLES,
    );

    return;
  }

  if (agent.owner_scope_id !== String(userId)) {
    throw new AssistantError("Forbidden", ErrorType.FORBIDDEN, 403);
  }
}

async function loadAgent(context: ServiceContext, agentId: string): Promise<Agent> {
  const agent = await context.repositories.agents.getAgentById(agentId);

  if (!agent) {
    throw new AssistantError("Agent not found", ErrorType.NOT_FOUND, 404);
  }

  return agent;
}

export async function requireAgentAccess(
  context: ServiceContext,
  agentId: string,
  action: AgentAccessAction,
  userId?: number,
): Promise<Agent> {
  const id = userId ?? context.requireUser().id;
  const agent = await loadAgent(context, agentId);

  await assertAgentAccess(context, agent, action, id);

  return agent;
}

export async function canAccessAgent(
  context: ServiceContext,
  agent: Pick<Agent, "owner_scope_type" | "owner_scope_id">,
  action: AgentAccessAction,
  userId: number,
): Promise<boolean> {
  try {
    await assertAgentAccess(context, agent, action, userId);

    return true;
  } catch (error) {
    if (error instanceof AssistantError) {
      return false;
    }

    throw error;
  }
}

export async function assertAgentAvailableToWorkspace(
  context: ServiceContext,
  agent: Pick<Agent, "owner_scope_type" | "owner_scope_id" | "user_id">,
  workspaceId: string,
): Promise<void> {
  if (isWorkspaceAgent(agent)) {
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
