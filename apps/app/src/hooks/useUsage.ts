import { useQuery } from "@tanstack/react-query";

import { getUsageBalance } from "~/lib/api/usage";

export const USAGE_QUERY_KEYS = {
  balance: ["usage", "balance"] as const,
};

const MAX_USAGE_BALANCE_REFRESH_INTERVAL = 24 * 60 * 60 * 1_000;
const MIN_USAGE_BALANCE_REFRESH_INTERVAL = 60 * 1_000;

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

export function useUsageBalance(enabled: boolean) {
  return useQuery({
    queryKey: USAGE_QUERY_KEYS.balance,
    queryFn: getUsageBalance,
    enabled,
    refetchInterval: (query) => getUsageBalanceRefreshInterval(query.state.data?.resets_at),
  });
}
