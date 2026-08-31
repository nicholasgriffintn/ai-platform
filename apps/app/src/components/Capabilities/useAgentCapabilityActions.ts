import type { AgentResponse } from "@ngriffin_uk/polychat-schemas";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { NEW_AGENT_ID } from "~/components/Agents/useAgentEditorController";
import { useAgents } from "~/hooks/useAgents";
import { capabilityCatalogQueryKey } from "~/hooks/useCapabilityCatalog";
import { useWorkspaces } from "~/hooks/useWorkspaces";
import { resolveAgentManagePermission } from "~/lib/agents/agent-permissions";
import { getAgentEditorPath, type CapabilitySurface } from "~/lib/capability-surfaces";
import { useChatStore } from "~/state/stores/chatStore";

export interface AgentCapabilityActions {
  attachableAgents: AgentResponse[];
  canManageAgent: (agentId: string) => boolean;
  canShareAgent: (agentId: string) => boolean;
  createPath: string;
  deleteAgent: (agentId: string) => Promise<void>;
  deletionError: Error | null;
  editPath: (agentId: string) => string;
  findAgent: (agentId: string) => AgentResponse | undefined;
  isDeleting: boolean;
  isLoadingAttachable: boolean;
  pendingAgentId?: string;
  refreshCatalogue: () => Promise<void>;
  resetDeletion: () => void;
}

export function useAgentCapabilityActions(
  surface: CapabilitySurface,
  attachedAgentIds: readonly string[],
): AgentCapabilityActions {
  const queryClient = useQueryClient();
  const currentUserId = useChatStore((state) => state.user?.id);
  const workspacesQuery = useWorkspaces();
  const {
    agents,
    isLoadingAgents,
    deleteAgentAsync,
    deleteAgentError,
    deletingAgentId,
    isDeletingAgent,
    resetAgentDeletion,
  } = useAgents();
  const workspaces = useMemo(
    () => workspacesQuery.data?.workspaces ?? [],
    [workspacesQuery.data?.workspaces],
  );
  const manageableAgentIds = useMemo(
    () =>
      new Set(
        agents
          .filter(
            (agent) => resolveAgentManagePermission(agent, currentUserId, workspaces).canManage,
          )
          .map((agent) => agent.id),
      ),
    [agents, currentUserId, workspaces],
  );
  const agentById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents]);
  const shareableAgentIds = useMemo(
    () =>
      new Set(
        agents
          .filter((agent) => agent.owner_scope_type === "user" && manageableAgentIds.has(agent.id))
          .map((agent) => agent.id),
      ),
    [agents, manageableAgentIds],
  );
  const attachableAgents = useMemo(() => {
    if (!surface.workspaceId) {
      return [];
    }

    const attached = new Set(attachedAgentIds);

    return agents.filter(
      (agent) =>
        agent.owner_scope_type === "workspace" &&
        agent.owner_scope_id === surface.workspaceId &&
        !attached.has(agent.id),
    );
  }, [agents, attachedAgentIds, surface.workspaceId]);

  const refreshCatalogue = () =>
    queryClient.invalidateQueries({ queryKey: capabilityCatalogQueryKey(surface.projectId) });

  return {
    attachableAgents,
    canManageAgent: (agentId: string) => manageableAgentIds.has(agentId),
    canShareAgent: (agentId: string) => shareableAgentIds.has(agentId),
    createPath: getAgentEditorPath(surface, NEW_AGENT_ID),
    deleteAgent: async (agentId: string) => {
      await deleteAgentAsync(agentId);
      await refreshCatalogue();
    },
    deletionError: deleteAgentError,
    editPath: (agentId: string) => getAgentEditorPath(surface, agentId),
    findAgent: (agentId: string) => agentById.get(agentId),
    isDeleting: isDeletingAgent,
    isLoadingAttachable: isLoadingAgents || workspacesQuery.isLoading,
    pendingAgentId: deletingAgentId,
    refreshCatalogue,
    resetDeletion: resetAgentDeletion,
  };
}
