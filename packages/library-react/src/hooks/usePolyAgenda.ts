import { apiService } from "@ngriffin_uk/polychat-library-client";
import { useQuery } from "@tanstack/react-query";

import { derivePolyPresence, type PolyPresence } from "../lib/pet/poly-presence.js";
import { liveOrPoll } from "../sync/live-or-poll.js";

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
