import { apiService } from "@ngriffin_uk/polychat-library-client";
import type { PolyHome, TeammateAutonomyLevel } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const POLY_HOME_QUERY_KEY = ["poly-home"] as const;

export function usePolyHome(enabled: boolean) {
  return useQuery({
    queryKey: POLY_HOME_QUERY_KEY,
    queryFn: () => apiService.openPolyHome(),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useSetPolyAutonomy(home: PolyHome | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (autonomyLevel: TeammateAutonomyLevel) => {
      if (!home) {
        throw new Error("Poly is not open yet");
      }

      return apiService.updateTeammateContextAutonomy(home.context_id, autonomyLevel);
    },
    onSuccess: (context) => {
      queryClient.setQueryData<PolyHome>(POLY_HOME_QUERY_KEY, (current) =>
        current && context.autonomyLevel
          ? { ...current, autonomy_level: context.autonomyLevel }
          : current,
      );
    },
  });
}
