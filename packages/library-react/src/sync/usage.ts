import { usageBalanceResponseSchema, usagePeriodFromDate } from "@ngriffin_uk/polychat-schemas";

import { USAGE_QUERY_KEYS } from "../chat/useUsage.js";
import { useUsageStore } from "../state/usageStore.js";
import type { SyncBinding } from "./bindings.js";

export const applyUsageChanged: SyncBinding["apply"] = ({ queryClient }, event) => {
  const result = usageBalanceResponseSchema.safeParse(event.data);

  if (!result.success) {
    return;
  }

  const balance = result.data;
  const isCurrentPeriod = balance.period === usagePeriodFromDate();

  if (isCurrentPeriod) {
    void queryClient.cancelQueries({ queryKey: USAGE_QUERY_KEYS.balance, exact: true });
    queryClient.setQueryData(USAGE_QUERY_KEYS.balance, balance);
    useUsageStore.getState().setUsageLimits({ credits: balance.credits });
  }

  for (const family of ["summary", "events"]) {
    void queryClient.invalidateQueries({
      queryKey: ["usage", family],
      predicate: ({ queryKey }) =>
        queryKey[2] === balance.period || (isCurrentPeriod && queryKey[2] === "current"),
      refetchType: "none",
    });
  }
};
