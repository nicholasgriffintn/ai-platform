import type { UsageLimits } from "@ngriffin_uk/polychat-library-react";
import type { UsageCreditsSummary } from "@ngriffin_uk/polychat-schemas";
import { formatCredits } from "@ngriffin_uk/polychat-utility-core";

import type { ComposerBannerDescriptor } from "../../Composer/ComposerBannerCard.js";

export function buildPoolUsageBanner(
  credits: UsageCreditsSummary,
): ComposerBannerDescriptor | null {
  if (credits.state === "exhausted") {
    return {
      id: "pool-exhausted",
      tone: "critical",
      title: "That was the last of this workspace's shared credits",
      message:
        "New turns in this workspace pause until the pool resets. Anything already running finishes.",
    };
  }

  if (credits.state === "reserve") {
    const remaining = Math.max(
      credits.included + credits.grace - credits.used - credits.reserved,
      0,
    );

    return {
      id: "pool-reserve",
      tone: "info",
      message: `This workspace is into its reserve, with about ${formatCredits(remaining)} shared credits left this period. Nothing stops; this is just a heads-up.`,
      dismissal: { scope: "session" },
    };
  }

  return null;
}

export function buildUsageBanner(usageLimits: UsageLimits | null): ComposerBannerDescriptor | null {
  const credits = usageLimits?.credits;

  if (!credits) {
    return null;
  }

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
