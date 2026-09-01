import type { UsageCreditsSummary } from "@ngriffin_uk/polychat-schemas";
import { formatCredits, getBoundedPercentage } from "@ngriffin_uk/polychat-utility-core";

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

const CREDIT_STATE_CAPTIONS: Record<UsageCreditsSummary["state"], string | undefined> = {
  ok: undefined,
  reserve: "Into your reserve",
  overage: "Billing overage",
  exhausted: "Paused until the period resets",
};

export function getBoundedUsagePercentage(used: number, limit: number) {
  return getBoundedPercentage(used, limit);
}

export function getSidebarUsageItems(
  usageLimits: UsageLimits | null,
  balanceCredits?: UsageCreditsSummary,
): SidebarUsageItem[] {
  const credits = balanceCredits ?? usageLimits?.credits;

  if (!credits) {
    return [];
  }

  const ceiling = credits.included + credits.grace;

  if (ceiling <= 0) {
    return [
      {
        id: "credits",
        label: "Credits",
        value: `${formatCredits(credits.used)} used`,
        assistiveLabel: `${formatCredits(credits.used)} credits used this month`,
        percentage: null,
        tone: "violet",
        caption: CREDIT_STATE_CAPTIONS[credits.state],
      },
    ];
  }

  const withinAllowance = credits.state === "ok";
  const scale = withinAllowance ? credits.included : ceiling;

  return [
    {
      id: "credits",
      label: "Credits",
      value: `${formatCredits(credits.used)} / ${formatCredits(credits.included)}`,
      assistiveLabel: `${formatCredits(credits.used)} of ${formatCredits(credits.included)} credits used this month`,
      percentage: getBoundedUsagePercentage(credits.used, scale),
      tone: "violet",
      reserveStartPercentage: withinAllowance ? undefined : (credits.included / ceiling) * 100,
      caption: CREDIT_STATE_CAPTIONS[credits.state],
    },
  ];
}
