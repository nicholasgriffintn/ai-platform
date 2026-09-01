import type { UsageCreditsSummary } from "@ngriffin_uk/polychat-schemas";

import type { ConversationManager } from "~/lib/conversationManager";
import { getLogger } from "~/utils/logger";

import { shouldStopRunaway } from "./credits";

const logger = getLogger({ prefix: "lib/usage/limitState" });

export const USAGE_LIMIT_NOTICE =
  "You have reached your usage limit, so I stopped here rather than continuing.";

export interface UsageLimitState {
  exhausted: boolean;
  credits?: UsageCreditsSummary;
}

const UNKNOWN_STATE: UsageLimitState = { exhausted: false };

export async function readUsageLimitState(
  conversationManager: Pick<ConversationManager, "getUsageLimits">,
): Promise<UsageLimitState> {
  try {
    const limits = await conversationManager.getUsageLimits();

    if (!limits?.credits) {
      return UNKNOWN_STATE;
    }

    return { exhausted: limits.credits.state === "exhausted", credits: limits.credits };
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
