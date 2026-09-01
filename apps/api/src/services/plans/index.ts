import type { PlanCreditsUpdate } from "@ngriffin_uk/polychat-schemas";

import { resolvePlanAllowanceCredits } from "~/lib/usage/planSeed";
import { RepositoryManager } from "~/repositories";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

function toPublicPlan(plan: Record<string, unknown>) {
  const allowance =
    typeof plan.id === "string"
      ? resolvePlanAllowanceCredits(plan.id, plan.included_credits, plan.grace_credits)
      : null;

  return {
    id: plan.id,
    name: plan.name,
    description: plan.description ?? null,
    price: plan.price,
    stripe_price_id: plan.stripe_price_id,
    included_credits: allowance?.includedCredits ?? null,
    grace_credits: allowance?.graceCredits ?? null,
    overage_available:
      typeof plan.overage_price_id === "string" && plan.overage_price_id.length > 0,
  };
}

export async function listPlans(env: IEnv) {
  const repositories = new RepositoryManager(env);
  const plans = await repositories.plans.getAllPlans();

  return plans.map(toPublicPlan);
}

export async function getPlanDetails(env: IEnv, id: string) {
  const repositories = new RepositoryManager(env);
  const plan = await repositories.plans.getPlanById(id);

  if (!plan) {
    throw new AssistantError("Plan not found", ErrorType.NOT_FOUND);
  }

  return toPublicPlan(plan);
}

export async function updatePlanCredits(env: IEnv, planId: string, update: PlanCreditsUpdate) {
  const repositories = new RepositoryManager(env);
  const plan = await repositories.plans.getPlanById(planId);

  if (!plan) {
    throw new AssistantError("Plan not found", ErrorType.NOT_FOUND);
  }

  await repositories.plans.updatePlanCredits(planId, update);

  return await repositories.plans.getPlanById(planId);
}
