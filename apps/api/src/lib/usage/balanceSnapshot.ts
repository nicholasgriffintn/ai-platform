import type { RepositoryManager } from "~/repositories";
import type { UsageBalanceRow } from "~/repositories/UsageBalanceRepository";

import { resolveUsagePlanSeed } from "./planSeed";

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

export async function resolveUsageBalanceSnapshot(
  repositories: RepositoryManager,
  userId: number,
  period: string,
): Promise<UsageBalanceSnapshot> {
  const balance = await repositories.usageBalances.getBalance(userId, period);

  if (balance) {
    return balance;
  }

  const seed = await resolveUsagePlanSeed(repositories, userId);

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
