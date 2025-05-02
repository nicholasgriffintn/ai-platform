import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiService } from "~/lib/api/api-service";

export const AGENTS_QUERY_KEYS = {
  all: ["agents"],
} as const;

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

  const createMutation = useMutation<
    any,
    Error,
    {
      name: string;
      description?: string;
      avatar_url: string | null;
      servers: any[];
    }
  >({
    mutationFn: ({ name, description, avatar_url, servers }) =>
      apiService.createAgent(name, servers, description, avatar_url),
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
    deleteAgent: deleteMutation.mutate,
    isDeletingAgent: deleteMutation.isPending,
  };
}
