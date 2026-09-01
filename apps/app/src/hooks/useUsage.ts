import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { getUsageBalance, getUsageSummary, listUsageEvents } from "~/lib/api/usage";
import { getNextUsageEventsPageParam } from "~/lib/usage-ledger";

export const USAGE_QUERY_KEYS = {
  balance: ["usage", "balance"] as const,
};

const MAX_USAGE_BALANCE_REFRESH_INTERVAL = 24 * 60 * 60 * 1_000;
const MIN_USAGE_BALANCE_REFRESH_INTERVAL = 60 * 1_000;
const USAGE_STALE_TIME = 60 * 1_000;
const USAGE_EVENTS_PAGE_SIZE = 25;

export function getUsageBalanceRefreshInterval(
  resetsAt: string | undefined,
  now = Date.now(),
): number {
  const resetAt = resetsAt ? Date.parse(resetsAt) : Number.NaN;

  if (!Number.isFinite(resetAt)) {
    return MAX_USAGE_BALANCE_REFRESH_INTERVAL;
  }

  return Math.min(
    MAX_USAGE_BALANCE_REFRESH_INTERVAL,
    Math.max(MIN_USAGE_BALANCE_REFRESH_INTERVAL, resetAt - now + 1_000),
  );
}

export function useUsageBalance(enabled = true) {
  return useQuery({
    queryKey: USAGE_QUERY_KEYS.balance,
    queryFn: () => getUsageBalance(),
    enabled,
    refetchInterval: (query) => getUsageBalanceRefreshInterval(query.state.data?.resets_at),
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
