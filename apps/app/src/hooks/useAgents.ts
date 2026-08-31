import type { AgentFormData } from "@ngriffin_uk/polychat-component-account";
import type { AgentResponse, UpdateAgentInput } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { groupAgents } from "~/lib/agents/group-agents";
import { apiService } from "~/lib/api/api-service";

import { useCanAccessProFeatures } from "./useCanAccessProFeatures";

export const AGENTS_QUERY_KEYS = {
  all: ["agents"],
} as const;

export function useAgents({ enabled = true }: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient();
  const canAccessProFeatures = useCanAccessProFeatures();

  const agentsQuery = useQuery<AgentResponse[]>({
    queryKey: AGENTS_QUERY_KEYS.all,
    queryFn: () => apiService.listAgents(),
    enabled: canAccessProFeatures && enabled,
    staleTime: 1000 * 60,
  });
  const agents = useMemo(
    () => (canAccessProFeatures && enabled ? (agentsQuery.data ?? []) : []),
    [canAccessProFeatures, enabled, agentsQuery.data],
  );

  const createMutation = useMutation<AgentResponse, Error, AgentFormData>({
    mutationFn: (data) => apiService.createAgent(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEYS.all });
    },
  });

  const updateMutation = useMutation<AgentResponse, Error, { id: string; data: UpdateAgentInput }>({
    mutationFn: ({ id, data }) => apiService.updateAgent(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEYS.all });
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (agentId) => apiService.deleteAgent(agentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEYS.all });
    },
  });

  const chatAgents = useMemo(
    () => agents.filter((agent) => !agent.is_team_agent || agent.team_role === "orchestrator"),
    [agents],
  );

  const groupedAgents = useMemo(() => groupAgents(agents), [agents]);

  return {
    agents,
    chatAgents,
    groupedAgents,
    isLoadingAgents: canAccessProFeatures && enabled ? agentsQuery.isLoading : false,
    errorAgents: canAccessProFeatures && enabled ? agentsQuery.error : null,
    createAgent: createMutation.mutateAsync,
    isCreatingAgent: createMutation.isPending,
    updateAgent: updateMutation.mutateAsync,
    isUpdatingAgent: updateMutation.isPending,
    deleteAgent: deleteMutation.mutate,
    isDeletingAgent: deleteMutation.isPending,
  };
}
