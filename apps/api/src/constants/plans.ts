export type PlanId = "free" | "pro" | "enterprise";

export const PLAN_RANKS: Record<PlanId, number> = {
  free: 0,
  pro: 10,
  enterprise: 20,
};

export const PLAN_IDS: readonly PlanId[] = ["free", "pro", "enterprise"];

export const DEFAULT_PLAN_ID: PlanId = "free";
