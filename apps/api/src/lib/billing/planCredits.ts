import { creditMicrosFromCredits } from "@ngriffin_uk/polychat-schemas";

import { defaultGraceCreditMicros } from "~/lib/usage/planSeed";

export interface PlanEntitlementMicros {
  includedCreditMicros: number;
  graceCreditMicros: number;
}

export function resolvePlanEntitlementMicros(
  plan: Record<string, unknown> | null,
): PlanEntitlementMicros | null {
  const included = plan?.included_credits;

  if (typeof included !== "number" || !Number.isFinite(included)) {
    return null;
  }

  const includedCreditMicros = creditMicrosFromCredits(included);
  const grace = plan?.grace_credits;
  const graceCreditMicros =
    typeof grace === "number" && Number.isFinite(grace)
      ? creditMicrosFromCredits(grace)
      : defaultGraceCreditMicros(includedCreditMicros);

  return { includedCreditMicros, graceCreditMicros };
}
