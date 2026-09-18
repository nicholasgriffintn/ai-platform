import type { CreditState } from "@ngriffin_uk/polychat-schemas";

export interface CreditStateInput {
  includedCreditMicros: number;
  graceCreditMicros: number;
  spentCreditMicros: number;
  reservedCreditMicros: number;
  overageEnabled: boolean;
}

export function resolveCreditState(input: CreditStateInput): CreditState {
  const committed = input.spentCreditMicros + input.reservedCreditMicros;

  if (input.includedCreditMicros <= 0) {
    return "ok";
  }

  if (committed < input.includedCreditMicros) {
    return "ok";
  }

  if (committed < input.includedCreditMicros + input.graceCreditMicros) {
    return "reserve";
  }

  return input.overageEnabled ? "overage" : "exhausted";
}
