import type { RepositoryManager } from "~/repositories";
import type { UsageBalanceRow } from "~/repositories/UsageBalanceRepository";

import { readActorCreditSpend, type CreditActor } from "./creditActor";
import { resolvePlanCreditAllowance, resolveUsagePlanSeed, ANONYMOUS_PLAN_ID } from "./planSeed";

export type UsageBalanceSnapshot = Pick<
  UsageBalanceRow,
  | "plan_id"
  | "included_credit_micros"
  | "grace_credit_micros"
  | "spent_credit_micros"
  | "reserved_credit_micros"
  | "overrun_credit_micros"
  | "overage_credit_micros"
  | "overage_enabled"
  | "last_event_at"
>;

async function resolveAnonymousSnapshot(
  repositories: RepositoryManager,
  actor: CreditActor,
  period: string,
): Promise<UsageBalanceSnapshot> {
  const [allowance, spend] = await Promise.all([
    resolvePlanCreditAllowance(repositories, ANONYMOUS_PLAN_ID),
    readActorCreditSpend(repositories, actor, period),
  ]);

  return {
    plan_id: allowance.planId,
    included_credit_micros: allowance.includedCreditMicros,
    grace_credit_micros: allowance.graceCreditMicros,
    spent_credit_micros: spend.spentCreditMicros,
    reserved_credit_micros: spend.reservedCreditMicros,
    overrun_credit_micros: 0,
    overage_credit_micros: 0,
    overage_enabled: 0,
    last_event_at: spend.lastEventAt,
  };
}

export async function resolveUsageBalanceSnapshot(
  repositories: RepositoryManager,
  actor: CreditActor,
  period: string,
): Promise<UsageBalanceSnapshot> {
  if (actor.kind === "anonymous") {
    return resolveAnonymousSnapshot(repositories, actor, period);
  }

  const [balance, seed] = await Promise.all([
    repositories.usageBalances.getBalance(actor.userId, period),
    resolveUsagePlanSeed(repositories, actor.userId),
  ]);

  if (balance) {
    return {
      ...balance,
      plan_id: seed.planId ?? balance.plan_id,
      included_credit_micros: seed.includedCreditMicros,
      grace_credit_micros: seed.graceCreditMicros,
    };
  }

  return {
    plan_id: seed.planId,
    included_credit_micros: seed.includedCreditMicros,
    grace_credit_micros: seed.graceCreditMicros,
    spent_credit_micros: 0,
    reserved_credit_micros: 0,
    overrun_credit_micros: 0,
    overage_credit_micros: 0,
    overage_enabled: 0,
    last_event_at: null,
  };
}
