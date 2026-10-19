import type { SpendState } from "@ngriffin_uk/polychat-schemas";

const NEAR_CAP_RATIO = 0.8;

export function resolveSpendState(
  creditMicros: number,
  capCreditMicros: number | null | undefined,
): SpendState {
  if (!capCreditMicros || capCreditMicros <= 0) {
    return "uncapped";
  }

  if (creditMicros >= capCreditMicros) {
    return "reached";
  }

  return creditMicros >= capCreditMicros * NEAR_CAP_RATIO ? "near" : "ok";
}

export function isSpendCapReached(
  creditMicros: number,
  capCreditMicros: number | null | undefined,
): boolean {
  return resolveSpendState(creditMicros, capCreditMicros) === "reached";
}
