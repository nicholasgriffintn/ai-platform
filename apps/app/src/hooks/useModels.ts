import { useQuery } from "@tanstack/react-query";

import { apiService } from "~/lib/api/api-service";

export const MODELS_QUERY_KEY = "models";

export const MODEL_CATALOGUE_QUERY_KEY = "model-catalogue";

export function useModels() {
  return useQuery({
    queryKey: [MODELS_QUERY_KEY],
    queryFn: apiService.fetchModels,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 60,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
}

export function useModelCatalogue() {
  return useQuery({
    queryKey: [MODEL_CATALOGUE_QUERY_KEY],
    queryFn: apiService.fetchModelCatalogue,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });
}
