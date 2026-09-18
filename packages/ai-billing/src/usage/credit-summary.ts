import { creditsFromCreditMicros, type UsageCreditsSummary } from "@ngriffin_uk/polychat-schemas";

import { resolveCreditState } from "../credit-state.js";
import type { UsageBalanceRecord } from "./store.js";

export function usageCreditsFromBalance(
  balance: Omit<UsageBalanceRecord, "plan_id" | "last_event_at">,
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
