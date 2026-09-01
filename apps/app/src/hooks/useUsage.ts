import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { getUsageBalance, getUsageSummary, listUsageEvents } from "~/lib/api/usage";
import { getNextUsageEventsPageParam } from "~/lib/usage-ledger";

export const USAGE_BALANCE_QUERY_KEY = ["usage", "balance"] as const;

const USAGE_STALE_TIME = 60 * 1000;
const USAGE_EVENTS_PAGE_SIZE = 25;

export function useUsageBalance(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: USAGE_BALANCE_QUERY_KEY,
    queryFn: () => getUsageBalance(),
    staleTime: USAGE_STALE_TIME,
    enabled: options.enabled ?? true,
  });
}

export function useUsageSummary(options: { period?: string; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["usage", "summary", options.period ?? "current"],
    queryFn: () => getUsageSummary(options.period),
    staleTime: USAGE_STALE_TIME,
    enabled: options.enabled ?? true,
  });
}

export function useUsageEvents(options: { period?: string; enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: ["usage", "events", options.period ?? "current"],
    queryFn: ({ pageParam }) =>
      listUsageEvents({
        period: options.period,
        cursor: pageParam,
        limit: USAGE_EVENTS_PAGE_SIZE,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: getNextUsageEventsPageParam,
    staleTime: USAGE_STALE_TIME,
    enabled: options.enabled ?? true,
  });
}
