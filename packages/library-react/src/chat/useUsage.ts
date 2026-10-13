import {
  getUsageBalance,
  getUsageSummary,
  listUsageEvents,
  getWorkspaceUsageSummary,
  useChatStore,
} from "@ngriffin_uk/polychat-library-client";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { getNextUsageEventsPageParam } from "../chat/usage-ledger.js";
import { useLiveOrPoll } from "../sync/live-or-poll.js";

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
  const liveOrPoll = useLiveOrPoll();
  const isAuthenticationLoading = useChatStore((state) => state.isAuthenticationLoading);

  return useQuery({
    queryKey: USAGE_QUERY_KEYS.balance,
    queryFn: () => getUsageBalance(),
    enabled: enabled && !isAuthenticationLoading,
    staleTime: USAGE_STALE_TIME,
    gcTime: 30 * 60 * 1_000,
    refetchInterval: (query) =>
      Math.min(
        getUsageBalanceRefreshInterval(query.state.data?.resets_at),
        liveOrPoll(query, USAGE_STALE_TIME, "usage.changed") || Number.POSITIVE_INFINITY,
      ),
  });
}

export function useUsageSummary(options: { period?: string; enabled?: boolean } = {}) {
  const liveOrPoll = useLiveOrPoll();
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: ["usage", "summary", options.period ?? "current"],
    queryFn: () => getUsageSummary(options.period),
    refetchInterval: (query) => liveOrPoll(query, USAGE_STALE_TIME, "usage.changed"),
    staleTime: USAGE_STALE_TIME,
    enabled: (options.enabled ?? true) && isAuthenticated,
  });
}

export function useUsageEvents(
  options: { period?: string; enabled?: boolean; source?: string } = {},
) {
  const liveOrPoll = useLiveOrPoll();
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);

  return useInfiniteQuery({
    queryKey: ["usage", "events", options.period ?? "current", options.source ?? "all"],
    queryFn: ({ pageParam }) =>
      listUsageEvents({
        period: options.period,
        cursor: pageParam,
        limit: USAGE_EVENTS_PAGE_SIZE,
        source: options.source,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: getNextUsageEventsPageParam,
    refetchInterval: (query) => liveOrPoll(query, USAGE_STALE_TIME, "usage.changed"),
    staleTime: USAGE_STALE_TIME,
    enabled: (options.enabled ?? true) && isAuthenticated,
  });
}

export function useWorkspaceUsage(workspaceId: string, period: string, enabled: boolean) {
  const liveOrPoll = useLiveOrPoll();
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: ["usage", "workspace", workspaceId, period],
    queryFn: () => getWorkspaceUsageSummary(workspaceId, period),
    refetchInterval: (query) => liveOrPoll(query, USAGE_STALE_TIME, "workspace_usage.changed"),
    enabled: enabled && isAuthenticated,
    staleTime: USAGE_STALE_TIME,
  });
}
