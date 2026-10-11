import { apiService } from "@ngriffin_uk/polychat-library-client";
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
