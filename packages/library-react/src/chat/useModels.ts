import { deviceModelSource } from "@ngriffin_uk/polychat-library-chat";
import { apiService } from "@ngriffin_uk/polychat-library-client";
import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";
import { useQuery } from "@tanstack/react-query";

export const MODELS_QUERY_KEY = "models";

export const MODEL_CATALOGUE_QUERY_KEY = "model-catalogue";

async function fetchModelsForSurface(): Promise<ModelConfig> {
  const source = deviceModelSource();

  if (!source) {
    return apiService.fetchModels();
  }

  const [served, onDevice] = await Promise.all([
    apiService.fetchModels(),
    source().catch((): ModelConfig => ({})),
  ]);

  return { ...served, ...onDevice };
}

export function useModels() {
  return useQuery({
    queryKey: [MODELS_QUERY_KEY],
    queryFn: fetchModelsForSurface,
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
