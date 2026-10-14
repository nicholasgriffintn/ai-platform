import { apiService } from "@ngriffin_uk/polychat-library-client";
import type { PolyHome, TeammateAutonomyLevel } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { POLY_AGENDA_QUERY_KEY } from "./usePolyAgenda.js";

export const POLY_HOME_QUERY_KEY = ["poly-home"] as const;

export function usePolyHome(enabled: boolean) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: POLY_HOME_QUERY_KEY,
    queryFn: async () => {
      const agenda = await apiService.readPolyAgenda({ ownerPresent: true });

      queryClient.setQueryData(POLY_AGENDA_QUERY_KEY, agenda);

      if (!agenda.home) {
        throw new Error("Poly could not be opened");
      }

      return agenda.home;
    },
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

export function usePolyStandingApprovals() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: POLY_HOME_QUERY_KEY });
  const grant = useMutation({
    mutationFn: (interactionId: string) => apiService.grantPolyStandingApproval(interactionId),
    onSuccess: refresh,
  });
  const revoke = useMutation({
    mutationFn: (approval: { toolName: string; destination: string }) =>
      apiService.revokePolyStandingApproval(approval.toolName, approval.destination),
    onSuccess: refresh,
  });

  return { grant, revoke };
}
