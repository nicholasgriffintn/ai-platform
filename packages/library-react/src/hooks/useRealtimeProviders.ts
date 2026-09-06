import { fetchRealtimeLiveProviders } from "@ngriffin_uk/polychat-library-client";
import { createRealtimeLiveProviderOptions } from "@ngriffin_uk/polychat-library-realtime/live-providers";
import { useQuery } from "@tanstack/react-query";

export const REALTIME_PROVIDERS_QUERY_KEY = ["realtime", "providers"] as const;

export function useRealtimeProviders(enabled = true) {
  return useQuery({
    queryKey: REALTIME_PROVIDERS_QUERY_KEY,
    queryFn: fetchRealtimeLiveProviders,
    enabled,
    select: ({ providers }) => createRealtimeLiveProviderOptions(providers),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}
