import { creditMicrosFromCredits, creditsFromCreditMicros } from "@ngriffin_uk/polychat-schemas";

import type { RepositoryManager } from "~/repositories";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/usage/plan-seed" });

const GRACE_INCLUDED_FRACTION = 0.1;
const GRACE_CEILING_FRACTION = 0.5;
const GRACE_FLOOR_CREDIT_MICROS = creditMicrosFromCredits(50);

export const ANONYMOUS_PLAN_ID = "anonymous";
export const DEFAULT_USER_PLAN_ID = "free";

const PLANS_WITHOUT_GRACE = new Set([ANONYMOUS_PLAN_ID, "free"]);

export function planEarnsGrace(planId: string): boolean {
  return !PLANS_WITHOUT_GRACE.has(planId);
}

export type UsagePlanResolution = "allowance" | "none" | "unavailable";

export interface UsagePlanSeed {
  planId: string | null;
  includedCreditMicros: number;
  graceCreditMicros: number;
  resolution: UsagePlanResolution;
}

const NO_ALLOWANCE = {
  includedCreditMicros: 0,
  graceCreditMicros: 0,
  resolution: "none",
} as const;

const ALLOWANCE_UNAVAILABLE = {
  includedCreditMicros: 0,
  graceCreditMicros: 0,
  resolution: "unavailable",
} as const;

export function defaultGraceCreditMicros(includedCreditMicros: number): number {
  return Math.min(
    Math.max(Math.round(includedCreditMicros * GRACE_INCLUDED_FRACTION), GRACE_FLOOR_CREDIT_MICROS),
    Math.round(includedCreditMicros * GRACE_CEILING_FRACTION),
  );
}

export function creditsAreEnforced(seed: Pick<UsagePlanSeed, "includedCreditMicros">): boolean {
  return seed.includedCreditMicros > 0;
}

export interface PlanAllowanceCredits {
  includedCredits: number;
  graceCredits: number;
}

export function resolvePlanAllowanceCredits(
  planId: string,
  configuredIncludedCredits?: unknown,
  configuredGraceCredits?: unknown,
): PlanAllowanceCredits | null {
  const includedCredits =
    typeof configuredIncludedCredits === "number" ? configuredIncludedCredits : null;

  if (includedCredits === null || includedCredits <= 0) {
    return null;
  }

  if (!planEarnsGrace(planId)) {
    return { includedCredits, graceCredits: 0 };
  }

  return {
    includedCredits,
    graceCredits:
      typeof configuredGraceCredits === "number"
        ? configuredGraceCredits
        : creditsFromCreditMicros(
            defaultGraceCreditMicros(creditMicrosFromCredits(includedCredits)),
          ),
  };
}

export async function resolvePlanCreditAllowance(
  repositories: RepositoryManager,
  planId: string | null | undefined,
): Promise<UsagePlanSeed> {
  if (!planId) {
    return { planId: null, ...NO_ALLOWANCE };
  }

  const plan = await repositories.plans.getPlanById(planId);
  const allowance = resolvePlanAllowanceCredits(
    planId,
    plan?.included_credits,
    plan?.grace_credits,
  );

  if (!allowance) {
    return { planId, ...NO_ALLOWANCE };
  }

  return {
    planId,
    includedCreditMicros: creditMicrosFromCredits(allowance.includedCredits),
    graceCreditMicros: creditMicrosFromCredits(allowance.graceCredits),
    resolution: "allowance",
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
      typeof user?.plan_id === "string" && user.plan_id ? user.plan_id : DEFAULT_USER_PLAN_ID,
    );
  } catch (error) {
    logger.warn("Failed to resolve plan seed for usage balance", { error, userId });

    return { planId: null, ...ALLOWANCE_UNAVAILABLE };
  }
}
