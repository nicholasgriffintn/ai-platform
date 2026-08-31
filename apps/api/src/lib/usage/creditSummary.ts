import { creditsFromCreditMicros, type UsageCreditsSummary } from "@ngriffin_uk/polychat-schemas";

import type { UsageBalanceRow } from "~/repositories/UsageBalanceRepository";

import { resolveCreditState } from "./creditState";

export function usageCreditsFromBalance(
  balance: Pick<
    UsageBalanceRow,
    | "included_credit_micros"
    | "grace_credit_micros"
    | "spent_credit_micros"
    | "reserved_credit_micros"
    | "overrun_credit_micros"
    | "overage_credit_micros"
    | "overage_enabled"
  >,
): UsageCreditsSummary {
  const included = balance.included_credit_micros;
  const grace = balance.grace_credit_micros;
  const spent = balance.spent_credit_micros;
  const reserved = balance.reserved_credit_micros;
  const overageEnabled = Boolean(balance.overage_enabled);

  return {
    included: creditsFromCreditMicros(included),
    used: creditsFromCreditMicros(spent),
    reserved: creditsFromCreditMicros(reserved),
    grace: creditsFromCreditMicros(grace),
    overrun: creditsFromCreditMicros(balance.overrun_credit_micros),
    overage: creditsFromCreditMicros(balance.overage_credit_micros),
    overage_enabled: overageEnabled,
    state: resolveCreditState({
      includedCreditMicros: included,
      graceCreditMicros: grace,
      spentCreditMicros: spent,
      reservedCreditMicros: reserved,
      overageEnabled,
    }),
  };
}
