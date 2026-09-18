import { creditMicrosFromCredits } from "@ngriffin_uk/polychat-schemas";

import { defaultGraceCreditMicros } from "./usage/plan-seed.js";

export type PlanId = "free" | "pro" | "enterprise";

export const PLAN_RANKS: Record<PlanId, number> = {
  free: 0,
  pro: 10,
  enterprise: 20,
};

export const PLAN_IDS: readonly PlanId[] = ["free", "pro", "enterprise"];

export const DEFAULT_PLAN_ID: PlanId = "free";

export function resolvePlanId(planId: string | null | undefined): PlanId {
  return PLAN_IDS.find((candidate) => candidate === planId) ?? DEFAULT_PLAN_ID;
}

export function hasPlanEntitlement(
  planId: string | null | undefined,
  requiredPlan: PlanId,
): boolean {
  return PLAN_RANKS[resolvePlanId(planId)] >= PLAN_RANKS[requiredPlan];
}

export interface PlanEntitlementMicros {
  includedCreditMicros: number;
  graceCreditMicros: number;
}

export function resolvePlanEntitlementMicros(
  plan: Record<string, unknown> | null,
): PlanEntitlementMicros | null {
  const included = plan?.included_credits;

  if (typeof included !== "number" || !Number.isFinite(included)) {
    return null;
  }

  const includedCreditMicros = creditMicrosFromCredits(included);
  const grace = plan?.grace_credits;
  const graceCreditMicros =
    typeof grace === "number" && Number.isFinite(grace)
      ? creditMicrosFromCredits(grace)
      : defaultGraceCreditMicros(includedCreditMicros);

  return { includedCreditMicros, graceCreditMicros };
}
