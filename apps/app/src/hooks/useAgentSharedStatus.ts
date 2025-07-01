import { useQuery } from "@tanstack/react-query";
import { apiService } from "~/lib/api/api-service";

export function useAgentSharedStatus(agentId: string) {
  return useQuery({
    queryKey: ["agent-shared-status", agentId],
    queryFn: () => apiService.checkAgentShared(agentId),
    enabled: !!agentId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useMultipleAgentsSharedStatus(agentIds: string[]) {
  return useQuery({
    queryKey: ["multiple-agents-shared-status", agentIds],
    queryFn: async () => {
      const results = await Promise.all(
        agentIds.map(async (agentId) => {
          try {
            const status = await apiService.checkAgentShared(agentId);
            return { agentId, ...status };
          } catch (error) {
            console.error(
              `Error checking shared status for agent ${agentId}:`,
              error,
            );
            return { agentId, isShared: false, sharedAgent: null };
          }
        }),
      );

      return results.reduce(
        (acc, result) => {
          acc[result.agentId] = {
            isShared: result.isShared,
            sharedAgent: result.sharedAgent,
          };
          return acc;
        },
        {} as Record<string, { isShared: boolean; sharedAgent: any | null }>,
      );
    },
    enabled: agentIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
