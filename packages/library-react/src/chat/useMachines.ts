import { apiService, useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useQuery } from "@tanstack/react-query";

import { liveOrPoll } from "../sync/live-or-poll.js";

export const MACHINES_QUERY_KEY = "machines";

export function useMachines(options: { enabled?: boolean } = {}) {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: [MACHINES_QUERY_KEY],
    queryFn: apiService.fetchMachines,
    enabled: Boolean(options.enabled ?? true) && isAuthenticated,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: "always",
    refetchInterval: (query) => liveOrPoll(query, 1000 * 60),
  });
}
