import type { UsageCreditsSummary } from "@ngriffin_uk/polychat-schemas";

import type { ConversationManager } from "~/lib/conversationManager";
import { getLogger } from "~/utils/logger";

import { shouldStopRunaway } from "./credits";

const logger = getLogger({ prefix: "lib/usage/limitState" });

export const USAGE_LIMIT_NOTICE =
  "You have reached your usage limit, so I stopped here rather than continuing.";

export interface UsageLimitState {
  exhausted: boolean;
  used: number;
  limit: number | null;
  credits?: UsageCreditsSummary;
}

const UNKNOWN_STATE: UsageLimitState = { exhausted: false, used: 0, limit: null };

export async function readUsageLimitState(
  conversationManager: Pick<ConversationManager, "getUsageLimits">,
): Promise<UsageLimitState> {
  try {
    const limits = await conversationManager.getUsageLimits();

    if (!limits) {
      return UNKNOWN_STATE;
    }

    const credits = limits.credits;
    const pro = limits.pro;

    if (credits) {
      const counter = pro && typeof pro.limit === "number" ? pro : limits.daily;

      return {
        exhausted: credits.state === "exhausted",
        used: counter?.used ?? 0,
        limit: typeof counter?.limit === "number" ? counter.limit : null,
        credits,
      };
    }

    if (pro && typeof pro.limit === "number") {
      return {
        exhausted: pro.used >= pro.limit,
        used: pro.used,
        limit: pro.limit,
      };
    }

    const daily = limits.daily;

    if (!daily || typeof daily.limit !== "number") {
      return UNKNOWN_STATE;
    }

    return {
      exhausted: daily.used >= daily.limit,
      used: daily.used,
      limit: daily.limit,
    };
  } catch (error) {
    logger.error("Failed to read usage limits", { error });

    return UNKNOWN_STATE;
  }
}

export async function isUsageExhausted(
  conversationManager: Pick<ConversationManager, "getUsageLimits">,
): Promise<boolean> {
  return (await readUsageLimitState(conversationManager)).exhausted;
}

export async function shouldStopTurnForUsage(
  conversationManager: Pick<ConversationManager, "getUsageLimits">,
): Promise<boolean> {
  const state = await readUsageLimitState(conversationManager);

  if (state.credits) {
    return shouldStopRunaway(state.credits);
  }

  return state.exhausted;
}
