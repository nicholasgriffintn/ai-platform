import type { AgentResponse, WorkspaceSummary } from "@ngriffin_uk/polychat-schemas";
import { areUserIdsEqual } from "@ngriffin_uk/polychat-utility-core";

const WORKSPACE_MANAGE_ROLES = new Set(["owner", "admin"]);

export interface AgentManagePermission {
  canManage: boolean;
  reason?: string;
  ownerLabel: string;
}

export function canManageWorkspace(workspace: Pick<WorkspaceSummary, "role">): boolean {
  return WORKSPACE_MANAGE_ROLES.has(workspace.role);
}

export function getAgentPublishTargets(
  workspaces: readonly WorkspaceSummary[],
): Array<{ id: string; name: string }> {
  return workspaces
    .filter(canManageWorkspace)
    .map((workspace) => ({ id: workspace.id, name: workspace.name }));
}

export function resolveAgentManagePermission(
  agent: AgentResponse | null,
  currentUserId: number | string | undefined,
  workspaces: readonly WorkspaceSummary[],
): AgentManagePermission {
  if (!agent) {
    return { canManage: true, ownerLabel: "you" };
  }

  if (agent.owner_scope_type === "workspace") {
    const workspace = workspaces.find((entry) => entry.id === agent.owner_scope_id);
    const ownerLabel = workspace?.name ?? "another workspace";

    if (workspace && canManageWorkspace(workspace)) {
      return { canManage: true, ownerLabel };
    }

    return {
      canManage: false,
      ownerLabel,
      reason: `${ownerLabel} owns this agent. You can use it, but only the workspace's owners and admins can change or delete it.`,
    };
  }

  if (areUserIdsEqual(agent.user_id, currentUserId)) {
    return { canManage: true, ownerLabel: "you" };
  }

  return {
    canManage: false,
    ownerLabel: "someone else",
    reason: "This agent belongs to someone else, so it cannot be changed here.",
  };
}
