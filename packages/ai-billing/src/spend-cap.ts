import {
  creditMicrosFromCredits,
  creditsFromCreditMicros,
  resolveSpendState,
} from "@ngriffin_uk/polychat-schemas";

export { resolveSpendState };

export function isSpendCapReached(
  creditMicros: number,
  capCreditMicros: number | null | undefined,
): boolean {
  return resolveSpendState(creditMicros, capCreditMicros) === "reached";
}

export interface RunStepCharge {
  chargedCreditMicros: number;
  capCreditMicros: number | null | undefined;
  stepEstimateCreditMicros: number;
}

export function runStepFitsCap(charge: RunStepCharge): boolean {
  if (!charge.capCreditMicros || charge.capCreditMicros <= 0) {
    return true;
  }

  return charge.chargedCreditMicros + charge.stepEstimateCreditMicros <= charge.capCreditMicros;
}

export function proposeRaisedRunCap(charge: RunStepCharge): number {
  const cap = charge.capCreditMicros ?? 0;
  const proposed = Math.max(
    cap * 2,
    charge.chargedCreditMicros + charge.stepEstimateCreditMicros * 2,
  );

  return creditMicrosFromCredits(Math.ceil(creditsFromCreditMicros(proposed)));
}
