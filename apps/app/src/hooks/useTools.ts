import { useQuery } from "@tanstack/react-query";

import { apiService } from "~/lib/api/api-service";

export const TOOLS_QUERY_KEY = "tools";

export function useTools() {
	return useQuery({
		queryKey: [TOOLS_QUERY_KEY],
		queryFn: apiService.fetchTools,
		staleTime: 1000 * 60 * 30, // Cache for 30 minutes
	});
}
