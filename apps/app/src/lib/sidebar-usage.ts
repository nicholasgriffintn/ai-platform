import type { UsageCreditsSummary } from "@ngriffin_uk/polychat-schemas";
import { formatCredits, getBoundedPercentage } from "@ngriffin_uk/polychat-utility-core";

import { isCreditsConfigured } from "~/lib/usage-limits";
import type { UsageLimits } from "~/state/stores/usageStore";

export interface SidebarUsageItem {
  id: string;
  label: string;
  value: string;
  assistiveLabel: string;
  percentage: number | null;
  tone: "blue" | "emerald" | "amber" | "violet";
  reserveStartPercentage?: number;
  caption?: string;
}

export function getBoundedUsagePercentage(used: number, limit: number) {
  return getBoundedPercentage(used, limit);
}

const CREDIT_STATE_CAPTIONS: Record<UsageCreditsSummary["state"], string | undefined> = {
  ok: undefined,
  reserve: "Into the reserve",
  overage: "In overage",
  exhausted: "Out of credits",
};

function getCreditsUsageItem(credits: UsageCreditsSummary): SidebarUsageItem {
  const capacity = credits.included + credits.grace;
  const committed = credits.used + credits.reserved;
  const inReserve = credits.state !== "ok";

  return {
    id: "credits",
    label: "Credits",
    value: `${formatCredits(credits.used)} / ${formatCredits(credits.included)}`,
    assistiveLabel: `${formatCredits(credits.used)} of ${formatCredits(credits.included)} included credits used this period`,
    percentage: inReserve
      ? getBoundedUsagePercentage(committed, capacity)
      : getBoundedUsagePercentage(committed, credits.included),
    tone: "violet",
    reserveStartPercentage: inReserve
      ? getBoundedUsagePercentage(credits.included, capacity)
      : undefined,
    caption: CREDIT_STATE_CAPTIONS[credits.state],
  };
}

export function getSidebarUsageItems(usageLimits: UsageLimits | null): SidebarUsageItem[] {
  if (!usageLimits) {
    return [];
  }

  if (isCreditsConfigured(usageLimits.credits)) {
    const items: SidebarUsageItem[] = [getCreditsUsageItem(usageLimits.credits)];

    if (usageLimits.byok) {
      items.push({
        id: "byok",
        label: "Your keys",
        value: `${usageLimits.byok.used} today`,
        assistiveLabel: `${usageLimits.byok.used} bring your own key messages used today`,
        percentage: null,
        tone: "emerald",
      });
    }

    return items;
  }

  const items: SidebarUsageItem[] = [
    {
      id: "standard",
      label: "Standard lane",
      value: `${usageLimits.daily.used} / ${usageLimits.daily.limit}`,
      assistiveLabel: `${usageLimits.daily.used} of ${usageLimits.daily.limit} standard messages used today`,
      percentage: getBoundedUsagePercentage(usageLimits.daily.used, usageLimits.daily.limit),
      tone: "blue",
    },
  ];

  if (usageLimits.pro) {
    items.push({
      id: "pro",
      label: "Pro runway",
      value: `${usageLimits.pro.used} / ${usageLimits.pro.limit}`,
      assistiveLabel: `${usageLimits.pro.used} of ${usageLimits.pro.limit} pro usage units used today`,
      percentage: getBoundedUsagePercentage(usageLimits.pro.used, usageLimits.pro.limit),
      tone: "amber",
    });
  }

  if (usageLimits.byok) {
    items.push({
      id: "byok",
      label: "Your keys",
      value: `${usageLimits.byok.used} today`,
      assistiveLabel: `${usageLimits.byok.used} bring your own key messages used today`,
      percentage: null,
      tone: "emerald",
    });
  }

  return items;
}
