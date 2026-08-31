import { createRealtimeLiveProviderOptions } from "@ngriffin_uk/polychat-library-realtime/live-providers";
import { useQuery } from "@tanstack/react-query";

import { fetchRealtimeLiveProviders } from "~/lib/api/realtime-service";

export const REALTIME_PROVIDERS_QUERY_KEY = ["realtime", "providers"] as const;

export function useRealtimeProviders() {
  return useQuery({
    queryKey: REALTIME_PROVIDERS_QUERY_KEY,
    queryFn: fetchRealtimeLiveProviders,
    select: ({ providers }) => createRealtimeLiveProviderOptions(providers),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}
