import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiService } from "~/lib/api/api-service";

export const AGENTS_QUERY_KEYS = {
  all: ["agents"],
} as const;

export type AgentData = {
  name: string;
  description?: string;
  avatar_url?: string;
  servers?: any[];
  model?: string;
  temperature?: number;
  max_steps?: number;
  system_prompt?: string;
  few_shot_examples?: Array<{ input: string; output: string }>;
};

export function useAgents() {
  const queryClient = useQueryClient();

  const {
    data: agents = [],
    isLoading: isLoadingAgents,
    error: errorAgents,
  } = useQuery<any[]>({
    queryKey: AGENTS_QUERY_KEYS.all,
    queryFn: () => apiService.listAgents(),
    staleTime: 1000 * 60,
  });

  const createMutation = useMutation<any, Error, AgentData>({
    mutationFn: ({
      name,
      description,
      avatar_url,
      servers,
      model,
      temperature,
      max_steps,
      system_prompt,
      few_shot_examples,
    }) =>
      apiService.createAgent(
        name,
        servers,
        description,
        avatar_url,
        model,
        temperature,
        max_steps,
        system_prompt,
        few_shot_examples,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEYS.all });
    },
  });

  const updateMutation = useMutation<
    any,
    Error,
    { id: string; data: Partial<AgentData> }
  >({
    mutationFn: ({ id, data }) => apiService.updateAgent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEYS.all });
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (agentId) => apiService.deleteAgent(agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEYS.all });
    },
  });

  return {
    agents,
    isLoadingAgents,
    errorAgents,
    createAgent: createMutation.mutateAsync,
    isCreatingAgent: createMutation.isPending,
    updateAgent: updateMutation.mutateAsync,
    isUpdatingAgent: updateMutation.isPending,
    deleteAgent: deleteMutation.mutate,
    isDeletingAgent: deleteMutation.isPending,
  };
}
