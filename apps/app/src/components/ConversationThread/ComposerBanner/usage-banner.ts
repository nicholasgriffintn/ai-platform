import type { ComposerBannerDescriptor } from "@ngriffin_uk/polychat-component-conversation";
import { formatCredits } from "@ngriffin_uk/polychat-utility-core";

import type { UsageLimits } from "~/state/stores/usageStore";

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
