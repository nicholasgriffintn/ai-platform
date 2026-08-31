import { DEFAULT_PLAN_ID, PLAN_IDS, PLAN_RANKS, type PlanId } from "~/constants/plans";

export function resolvePlanId(planId: string | null | undefined): PlanId {
  return PLAN_IDS.find((candidate) => candidate === planId) ?? DEFAULT_PLAN_ID;
}

export function hasPlanEntitlement(
  planId: string | null | undefined,
  requiredPlan: PlanId,
): boolean {
  return PLAN_RANKS[resolvePlanId(planId)] >= PLAN_RANKS[requiredPlan];
}
