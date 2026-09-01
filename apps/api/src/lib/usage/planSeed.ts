import { creditMicrosFromCredits } from "@ngriffin_uk/polychat-schemas";

import type { RepositoryManager } from "~/repositories";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/usage/plan-seed" });

const GRACE_INCLUDED_FRACTION = 0.1;
const GRACE_FLOOR_CREDIT_MICROS = creditMicrosFromCredits(50);

export interface UsagePlanSeed {
  planId: string | null;
  includedCreditMicros: number;
  graceCreditMicros: number;
}

const UNCONFIGURED_ALLOWANCE = { includedCreditMicros: 0, graceCreditMicros: 0 } as const;

export function defaultGraceCreditMicros(includedCreditMicros: number): number {
  return Math.max(
    Math.round(includedCreditMicros * GRACE_INCLUDED_FRACTION),
    GRACE_FLOOR_CREDIT_MICROS,
  );
}

export function creditsAreEnforced(seed: Pick<UsagePlanSeed, "includedCreditMicros">): boolean {
  return seed.includedCreditMicros > 0;
}

export async function resolvePlanCreditAllowance(
  repositories: RepositoryManager,
  planId: string | null | undefined,
): Promise<UsagePlanSeed> {
  if (!planId) {
    return { planId: null, ...UNCONFIGURED_ALLOWANCE };
  }

  const plan = await repositories.plans.getPlanById(planId);
  const includedCredits = plan?.included_credits;

  if (typeof includedCredits !== "number" || includedCredits <= 0) {
    return { planId, ...UNCONFIGURED_ALLOWANCE };
  }

  const includedCreditMicros = creditMicrosFromCredits(includedCredits);
  const graceCredits = plan?.grace_credits;

  return {
    planId,
    includedCreditMicros,
    graceCreditMicros:
      typeof graceCredits === "number"
        ? creditMicrosFromCredits(graceCredits)
        : defaultGraceCreditMicros(includedCreditMicros),
  };
}

export async function resolveUsagePlanSeed(
  repositories: RepositoryManager,
  userId: number,
): Promise<UsagePlanSeed> {
  try {
    const user = await repositories.users.getUserById(userId);

    return await resolvePlanCreditAllowance(
      repositories,
      typeof user?.plan_id === "string" ? user.plan_id : null,
    );
  } catch (error) {
    logger.warn("Failed to resolve plan seed for usage balance", { error, userId });

    return { planId: null, ...UNCONFIGURED_ALLOWANCE };
  }
}
