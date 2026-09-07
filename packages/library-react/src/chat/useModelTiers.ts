import { apiService } from "@ngriffin_uk/polychat-library-client";
import { useQuery } from "@tanstack/react-query";

import { MODELS_QUERY_KEY } from "./useModels.js";

export const MODEL_TIERS_QUERY_KEY = [MODELS_QUERY_KEY, "tiers"] as const;

export function useModelTiers() {
  return useQuery({
    queryKey: MODEL_TIERS_QUERY_KEY,
    queryFn: apiService.fetchModelTiers,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 60,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
}
