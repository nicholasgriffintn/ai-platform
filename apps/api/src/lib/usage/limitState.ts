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

    const daily = limits.daily;
    const credits = limits.credits;

    if (credits) {
      return {
        exhausted: credits.state === "exhausted",
        used: daily?.used ?? 0,
        limit: typeof daily?.limit === "number" ? daily.limit : null,
        credits,
      };
    }

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
