import { useQuery } from "@tanstack/react-query";

import { apiService } from "~/lib/api/api-service";

export const MODELS_QUERY_KEY = "models";

export function useModels() {
  return useQuery({
    queryKey: [MODELS_QUERY_KEY],
    queryFn: apiService.fetchModels,
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
  });
}
