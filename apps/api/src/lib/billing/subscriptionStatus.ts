import type { PlanId } from "~/constants/plans";

export const ENTITLED_SUBSCRIPTION_STATUSES: readonly string[] = ["active", "trialing"];

export const REVOKED_SUBSCRIPTION_STATUSES: readonly string[] = [
  "past_due",
  "unpaid",
  "incomplete_expired",
  "paused",
  "canceled",
];

export function resolvePlanForSubscriptionStatus(status: string): PlanId | null {
  if (ENTITLED_SUBSCRIPTION_STATUSES.includes(status)) {
    return "pro";
  }

  if (REVOKED_SUBSCRIPTION_STATUSES.includes(status)) {
    return "free";
  }

  return null;
}
