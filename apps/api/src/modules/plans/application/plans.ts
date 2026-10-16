import { ANONYMOUS_PLAN_ID, resolvePlanAllowanceCredits } from "@ngriffin_uk/polychat-ai-billing";
import type { PlanCreditsUpdate } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { PlanRecord } from "~/infrastructure/database/schema";
import { PlanRepository } from "~/modules/plans/infrastructure/PlanRepository";
import type { IEnv } from "~/types";

function toPublicPlan(plan: PlanRecord) {
  const allowance = resolvePlanAllowanceCredits(plan.id, plan.included_credits, plan.grace_credits);

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
  const plans = await new PlanRepository(env).getAllPlans();

  return plans.filter((plan) => plan.id !== ANONYMOUS_PLAN_ID).map(toPublicPlan);
}

export async function getPlanDetails(env: IEnv, id: string) {
  const plan = await new PlanRepository(env).getPlanById(id);

  if (!plan) {
    throw new AssistantError("Plan not found", ErrorType.NOT_FOUND);
  }

  return toPublicPlan(plan);
}

export async function updatePlanCredits(env: IEnv, planId: string, update: PlanCreditsUpdate) {
  const planRepository = new PlanRepository(env);
  const plan = await planRepository.getPlanById(planId);

  if (!plan) {
    throw new AssistantError("Plan not found", ErrorType.NOT_FOUND);
  }

  await planRepository.updatePlanCredits(planId, update);

  return await planRepository.getPlanById(planId);
}
