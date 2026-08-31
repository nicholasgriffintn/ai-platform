import { usageLimitsSchema, type UsageLimitsPayload } from "@ngriffin_uk/polychat-schemas";

import type { UsageLimits } from "~/state/stores/usageStore";
import type { AnonymousUser, User } from "~/types";

export const NON_AUTH_DAILY_MESSAGE_LIMIT = 10;
export const AUTH_DAILY_MESSAGE_LIMIT = 50;

export function normaliseUsageLimits(value: unknown): UsageLimits | null {
  const parsed = usageLimitsSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

export function getUsageLimitsFromUser(user: User | null): UsageLimits | null {
  if (!user) {
    return null;
  }

  const hasPaidPlan = user.plan_id === "pro";
  const usageLimits: UsageLimitsPayload = {
    daily: {
      used: hasPaidPlan ? 0 : (user.daily_message_count ?? 0),
      limit: hasPaidPlan ? null : AUTH_DAILY_MESSAGE_LIMIT,
    },
  };

  return usageLimits;
}

export function getUsageLimitsFromAnonymousUser(anonymousUser: AnonymousUser | null) {
  if (!anonymousUser) {
    return null;
  }

  return {
    daily: {
      used: anonymousUser.daily_message_count ?? 0,
      limit: NON_AUTH_DAILY_MESSAGE_LIMIT,
    },
  };
}
