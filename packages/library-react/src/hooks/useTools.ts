import { apiService } from "@ngriffin_uk/polychat-library-client";
import { useQuery } from "@tanstack/react-query";

export const TOOLS_QUERY_KEY = "tools";

export function useTools({
  enabled = true,
  projectId,
  workspaceId,
}: { enabled?: boolean; projectId?: string; workspaceId?: string } = {}) {
  return useQuery({
    queryKey: [TOOLS_QUERY_KEY, { projectId, workspaceId }],
    queryFn: () => apiService.fetchTools(projectId, workspaceId),
    enabled,
    staleTime: 30_000,
    gcTime: 1000 * 60 * 60,
  });
}
