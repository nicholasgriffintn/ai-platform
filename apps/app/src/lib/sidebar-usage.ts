import type { UsageCreditsSummary } from "@ngriffin_uk/polychat-schemas";
import { getBoundedPercentage } from "@ngriffin_uk/polychat-utility-core";

import type { UsageLimits } from "~/state/stores/usageStore";

export interface SidebarUsageItem {
  id: string;
  label: string;
  value: string;
  assistiveLabel: string;
  percentage: number | null;
  tone: "blue" | "emerald" | "amber";
}

export function getBoundedUsagePercentage(used: number, limit: number) {
  return getBoundedPercentage(used, limit);
}

export function getSidebarUsageItems(
  usageLimits: UsageLimits | null,
  balanceCredits?: UsageCreditsSummary,
): SidebarUsageItem[] {
  if (!usageLimits && !balanceCredits) {
    return [];
  }

  const items: SidebarUsageItem[] = [];

  if (typeof usageLimits?.daily.limit === "number") {
    items.push({
      id: "standard",
      label: "Standard lane",
      value: `${usageLimits.daily.used} / ${usageLimits.daily.limit}`,
      assistiveLabel: `${usageLimits.daily.used} of ${usageLimits.daily.limit} standard messages used today`,
      percentage: getBoundedUsagePercentage(usageLimits.daily.used, usageLimits.daily.limit),
      tone: "blue",
    });
  }

  const credits = balanceCredits ?? usageLimits?.credits;

  if (credits) {
    const allowance = credits.included + credits.grace;
    const hasAllowance = allowance > 0;

    items.push({
      id: "credits",
      label: "Credits",
      value: hasAllowance ? `${credits.used} / ${allowance}` : `${credits.used} used`,
      assistiveLabel: hasAllowance
        ? `${credits.used} of ${allowance} credits used this month`
        : `${credits.used} credits used this month`,
      percentage: hasAllowance ? getBoundedUsagePercentage(credits.used, allowance) : null,
      tone: "amber",
    });
  }

  return items;
}
