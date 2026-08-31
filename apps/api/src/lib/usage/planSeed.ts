import { creditMicrosFromCredits } from "@ngriffin_uk/polychat-schemas";

import type { RepositoryManager } from "~/repositories";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/usage/plan-seed" });

export interface UsagePlanSeed {
  planId: string | null;
  includedCreditMicros: number;
  graceCreditMicros: number;
}

export async function resolveUsagePlanSeed(
  repositories: RepositoryManager,
  userId: number,
): Promise<UsagePlanSeed> {
  try {
    const user = await repositories.users.getUserById(userId);
    const planId = typeof user?.plan_id === "string" ? user.plan_id : null;

    if (!planId) {
      return { planId: null, includedCreditMicros: 0, graceCreditMicros: 0 };
    }

    const plan = await repositories.plans.getPlanById(planId);

    return {
      planId,
      includedCreditMicros: creditMicrosFromCredits(
        typeof plan?.included_credits === "number" ? plan.included_credits : 0,
      ),
      graceCreditMicros: creditMicrosFromCredits(
        typeof plan?.grace_credits === "number" ? plan.grace_credits : 0,
      ),
    };
  } catch (error) {
    logger.warn("Failed to resolve plan seed for usage balance", { error, userId });

    return { planId: null, includedCreditMicros: 0, graceCreditMicros: 0 };
  }
}
