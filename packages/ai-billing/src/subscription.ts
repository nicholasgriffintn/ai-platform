export type SubscriptionPlanId = "free" | "pro";

export const DEFAULT_PAID_PLAN_ID = "pro" as const;

export const ENTITLED_SUBSCRIPTION_STATUSES: readonly string[] = ["active", "trialing"];

const REVOKED_SUBSCRIPTION_STATUSES: ReadonlySet<string> = new Set([
  "past_due",
  "unpaid",
  "incomplete_expired",
  "paused",
  "canceled",
]);

export function resolvePlanForSubscriptionStatus(status: string): SubscriptionPlanId | null {
  if (ENTITLED_SUBSCRIPTION_STATUSES.includes(status)) {
    return DEFAULT_PAID_PLAN_ID;
  }

  if (REVOKED_SUBSCRIPTION_STATUSES.has(status)) {
    return "free";
  }

  return null;
}
