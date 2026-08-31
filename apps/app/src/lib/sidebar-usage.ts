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

export function getSidebarUsageItems(usageLimits: UsageLimits | null): SidebarUsageItem[] {
  if (!usageLimits) {
    return [];
  }

  const items: SidebarUsageItem[] = [];

  if (typeof usageLimits.daily.limit === "number") {
    items.push({
      id: "standard",
      label: "Standard lane",
      value: `${usageLimits.daily.used} / ${usageLimits.daily.limit}`,
      assistiveLabel: `${usageLimits.daily.used} of ${usageLimits.daily.limit} standard messages used today`,
      percentage: getBoundedUsagePercentage(usageLimits.daily.used, usageLimits.daily.limit),
      tone: "blue",
    });
  }

  if (usageLimits.credits) {
    const allowance = usageLimits.credits.included + usageLimits.credits.grace;

    items.push({
      id: "credits",
      label: "Credits",
      value: `${usageLimits.credits.used} / ${allowance}`,
      assistiveLabel: `${usageLimits.credits.used} of ${allowance} credits used this month`,
      percentage:
        allowance > 0 ? getBoundedUsagePercentage(usageLimits.credits.used, allowance) : 0,
      tone: "amber",
    });
  }

  return items;
}
