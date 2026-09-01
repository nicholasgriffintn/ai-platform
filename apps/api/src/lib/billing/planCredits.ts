import { creditMicrosFromCredits, MICRO_CREDITS_PER_CREDIT } from "@ngriffin_uk/polychat-schemas";

const GRACE_FRACTION_OF_INCLUDED = 0.1;
const MINIMUM_GRACE_CREDITS = 50;

export interface PlanEntitlementMicros {
  includedCreditMicros: number;
  graceCreditMicros: number;
}

export function defaultGraceCreditMicros(includedCreditMicros: number): number {
  return Math.max(
    Math.round(includedCreditMicros * GRACE_FRACTION_OF_INCLUDED),
    MINIMUM_GRACE_CREDITS * MICRO_CREDITS_PER_CREDIT,
  );
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
