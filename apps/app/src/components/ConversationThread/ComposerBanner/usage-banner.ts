import type { ComposerBannerDescriptor } from "@ngriffin_uk/polychat-component-conversation";
import type { UsageCreditsSummary } from "@ngriffin_uk/polychat-schemas";
import { formatCredits } from "@ngriffin_uk/polychat-utility-core";

import { isCreditsConfigured } from "~/lib/usage-limits";
import type { UsageLimits } from "~/state/stores/usageStore";

const USAGE_WARNING_THRESHOLD = 0.2;

function buildCreditBanner(credits: UsageCreditsSummary): ComposerBannerDescriptor | null {
  if (credits.state === "exhausted") {
    return {
      id: "credits-exhausted",
      tone: "critical",
      title: "That was the last of this period's credits",
      message:
        "New turns pause until the period resets. Anything already running finishes, and switching on overage in Billing lifts the pause.",
      action: { label: "Open Billing", to: "/profile?tab=billing" },
    };
  }

  if (credits.state === "reserve") {
    const remaining = Math.max(
      credits.included + credits.grace - credits.used - credits.reserved,
      0,
    );

    return {
      id: "credits-reserve",
      tone: "info",
      message: `You are into your reserve — about ${formatCredits(remaining)} credits of headroom left this period. Nothing stops; this is just a heads-up.`,
      dismissal: { scope: "session" },
    };
  }

  return null;
}

export function buildUsageBanner(
  usageLimits: UsageLimits | null,
  isPro: boolean,
): ComposerBannerDescriptor | null {
  if (!usageLimits) {
    return null;
  }

  if (isCreditsConfigured(usageLimits.credits)) {
    return buildCreditBanner(usageLimits.credits);
  }

  const { daily, pro } = usageLimits;
  const dailyRemaining = daily.limit - daily.used;

  if (dailyRemaining <= 0) {
    return {
      id: "usage-daily-exhausted",
      tone: "critical",
      title: "Out of messages for today",
      message: isPro
        ? "Your daily allowance has run dry. Your own provider keys still work, if you have them configured."
        : "Your daily allowance has run dry. Upgrade to Pro or add your own provider keys to keep going.",
      action: isPro
        ? { label: "Open Providers", to: "/profile?tab=providers" }
        : { label: "See plans", to: "/pricing" },
    };
  }

  if (isPro && pro) {
    const proRemaining = pro.limit - pro.used;

    if (proRemaining <= 0) {
      return {
        id: "usage-pro-exhausted",
        tone: "warning",
        message:
          "That was the last of today's Pro messages. Standard models are still on the perch.",
        dismissal: { scope: "day" },
      };
    }

    if (proRemaining / pro.limit <= USAGE_WARNING_THRESHOLD) {
      return {
        id: "usage-pro-low",
        tone: "warning",
        message: `You have ${proRemaining} Pro ${proRemaining === 1 ? "message" : "messages"} left today.`,
        dismissal: { scope: "day" },
      };
    }
  }

  if (daily.limit > 0 && dailyRemaining / daily.limit <= USAGE_WARNING_THRESHOLD) {
    return {
      id: "usage-daily-low",
      tone: "warning",
      message: isPro
        ? `You have ${dailyRemaining} standard ${dailyRemaining === 1 ? "message" : "messages"} left today.`
        : `You have ${dailyRemaining} ${dailyRemaining === 1 ? "message" : "messages"} left today. Pro raises the ceiling, and your own keys remove it.`,
      action: isPro ? undefined : { label: "See plans", to: "/pricing" },
      dismissal: { scope: "day" },
    };
  }

  return null;
}
