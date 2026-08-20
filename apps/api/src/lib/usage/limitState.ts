import type { ConversationManager } from "~/lib/conversationManager";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/usage/limitState" });

export const USAGE_LIMIT_NOTICE =
  "You have reached your usage limit, so I stopped here rather than continuing.";

export interface UsageLimitState {
  exhausted: boolean;
  used: number;
  limit: number | null;
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

    const pro = limits.pro;

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
