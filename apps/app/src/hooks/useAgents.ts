import type { AgentFormData } from "@ngriffin_uk/polychat-component-account";
import type { AgentResponse, UpdateAgentInput } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { apiService } from "~/lib/api/api-service";

import { useCanAccessProFeatures } from "./useCanAccessProFeatures";

export const AGENTS_QUERY_KEYS = {
  all: ["agents"],
  detail: (agentId: string) => ["agents", agentId],
} as const;

export function useAgent(agentId?: string) {
  const canAccessProFeatures = useCanAccessProFeatures();

  return useQuery<AgentResponse>({
    queryKey: AGENTS_QUERY_KEYS.detail(agentId ?? ""),
    queryFn: () => apiService.getAgent(agentId ?? ""),
    enabled: canAccessProFeatures && Boolean(agentId),
    staleTime: 1000 * 60,
  });
}

export function usePublishAgentToWorkspace() {
  const queryClient = useQueryClient();

  return useMutation<AgentResponse, Error, { agentId: string; workspaceId: string }>({
    mutationFn: ({ agentId, workspaceId }) =>
      apiService.publishAgentToWorkspace(agentId, workspaceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEYS.all });
    },
  });
}

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

  return {
    agents,
    isLoadingAgents: canAccessProFeatures && enabled ? agentsQuery.isLoading : false,
    errorAgents: canAccessProFeatures && enabled ? agentsQuery.error : null,
    createAgent: createMutation.mutateAsync,
    isCreatingAgent: createMutation.isPending,
    updateAgent: updateMutation.mutateAsync,
    isUpdatingAgent: updateMutation.isPending,
    deleteAgent: deleteMutation.mutate,
    deleteAgentAsync: deleteMutation.mutateAsync,
    deleteAgentError: deleteMutation.error,
    deletingAgentId: deleteMutation.isPending ? deleteMutation.variables : undefined,
    isDeletingAgent: deleteMutation.isPending,
    resetAgentDeletion: deleteMutation.reset,
  };
}
