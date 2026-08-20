import { useQuery } from "@tanstack/react-query";

import { apiService } from "~/lib/api/api-service";

export const TOOLS_QUERY_KEY = "tools";

export function useTools({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [TOOLS_QUERY_KEY],
    queryFn: apiService.fetchTools,
    enabled,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60,
  });
}
