import { apiService } from "@ngriffin_uk/polychat-library-client";
import type { PolyAgenda, TeammateAutonomyLevel } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { derivePolyPresence, type PolyPresence } from "../lib/pet/poly-presence.js";
import { liveOrPoll } from "../sync/live-or-poll.js";
import { CORRECTIONS_QUERY_KEY } from "./useCorrections.js";

export const POLY_AGENDA_QUERY_KEY = ["poly-agenda"] as const;

const AGENDA_POLL_MS = 30_000;

export function usePolyAgenda(enabled: boolean) {
  return useQuery({
    queryKey: POLY_AGENDA_QUERY_KEY,
    queryFn: () => apiService.readPolyAgenda(),
    enabled,
    refetchInterval: (query) => liveOrPoll(query, AGENDA_POLL_MS, "delegation.changed"),
  });
}

export function usePolyPresence(enabled: boolean): PolyPresence | null {
  const agenda = usePolyAgenda(enabled);

  return agenda.data ? derivePolyPresence(agenda.data) : null;
}

export function useDisagreeWithPolyHandoff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (handoffId: string) => apiService.disagreeWithPolyHandoff(handoffId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: POLY_AGENDA_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: CORRECTIONS_QUERY_KEY }),
      ]),
  });
}

export function useSetPolyAutonomy(agenda: PolyAgenda | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (autonomyLevel: TeammateAutonomyLevel) => {
      if (!agenda) {
        throw new Error("Poly is not open yet");
      }

      return apiService.updateTeammateContextAutonomy(agenda.context_id, autonomyLevel);
    },
    onSuccess: (context) => {
      queryClient.setQueryData<PolyAgenda>(POLY_AGENDA_QUERY_KEY, (current) =>
        current && context.autonomyLevel
          ? { ...current, autonomy_level: context.autonomyLevel }
          : current,
      );
    },
  });
}

export function usePolyStandingApprovals() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: POLY_AGENDA_QUERY_KEY });
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
