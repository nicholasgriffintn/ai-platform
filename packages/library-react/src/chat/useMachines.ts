import { apiService, useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useQuery } from "@tanstack/react-query";

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
    refetchInterval: 1000 * 60,
  });
}
