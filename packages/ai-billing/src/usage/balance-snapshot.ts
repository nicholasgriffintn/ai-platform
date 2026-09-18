import { readActorCreditSpend, type CreditActor } from "./credit-actor.js";
import {
  ANONYMOUS_PLAN_ID,
  resolvePlanCreditAllowance,
  resolveUsagePlanSeed,
} from "./plan-seed.js";
import type { UsageBalanceRecord, UsageStore } from "./store.js";

export type UsageBalanceSnapshot = UsageBalanceRecord;

async function resolveAnonymousSnapshot(
  store: UsageStore,
  actor: CreditActor,
  period: string,
): Promise<UsageBalanceSnapshot> {
  const [allowance, spend] = await Promise.all([
    resolvePlanCreditAllowance(store, ANONYMOUS_PLAN_ID),
    readActorCreditSpend(store, actor, period),
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
  store: UsageStore,
  actor: CreditActor,
  period: string,
): Promise<UsageBalanceSnapshot> {
  if (actor.kind === "anonymous") {
    return resolveAnonymousSnapshot(store, actor, period);
  }

  const [balance, seed] = await Promise.all([
    store.getUserBalance(actor.userId, period),
    resolveUsagePlanSeed(store, actor.userId),
  ]);

  if (balance) {
    return {
      plan_id: seed.planId ?? balance.plan_id,
      included_credit_micros: seed.includedCreditMicros,
      grace_credit_micros: seed.graceCreditMicros,
      spent_credit_micros: balance.spent_credit_micros,
      reserved_credit_micros: balance.reserved_credit_micros,
      overrun_credit_micros: balance.overrun_credit_micros,
      overage_credit_micros: balance.overage_credit_micros,
      overage_enabled: balance.overage_enabled,
      last_event_at: balance.last_event_at,
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
