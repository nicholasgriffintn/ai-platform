import { useQuery } from "@tanstack/react-query";

import { getUsageBalance } from "~/lib/api/usage";

export const USAGE_QUERY_KEYS = {
  balance: ["usage", "balance"] as const,
};

export function useUsageBalance(enabled: boolean) {
  return useQuery({
    queryKey: USAGE_QUERY_KEYS.balance,
    queryFn: getUsageBalance,
    enabled,
  });
}
