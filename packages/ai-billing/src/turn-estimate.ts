import {
  creditMicrosFromCostMicros,
  creditMicrosFromCredits,
  DEFAULT_MARGIN,
  type ModelConfigItem,
  type UsageCreditsSummary,
} from "@ngriffin_uk/polychat-schemas";

const OVERRUN_CAP_GRACE_FRACTION = 0.25;
const OVERRUN_CAP_FLOOR_CREDIT_MICROS = creditMicrosFromCredits(25);

const TURN_OUTPUT_ALLOWANCE_MAX_TOKENS = 8192;

export function overrunCapCreditMicros(graceCreditMicros: number): number {
  return Math.max(
    Math.round(graceCreditMicros * OVERRUN_CAP_GRACE_FRACTION),
    OVERRUN_CAP_FLOOR_CREDIT_MICROS,
  );
}

export function shouldStopRunaway(credits: UsageCreditsSummary): boolean {
  const includedCreditMicros = creditMicrosFromCredits(credits.included);

  if (includedCreditMicros <= 0) {
    return false;
  }

  const graceCreditMicros = creditMicrosFromCredits(credits.grace);

  return (
    creditMicrosFromCredits(credits.used) >
    includedCreditMicros + graceCreditMicros + overrunCapCreditMicros(graceCreditMicros)
  );
}

type TurnCostModelConfig = Pick<
  ModelConfigItem,
  "costPer1kInputTokens" | "costPer1kOutputTokens" | "maxTokens"
>;

function tokenCostMicros(tokens: number, costPer1kTokens: number | undefined): number {
  return tokens * (costPer1kTokens ?? 0) * 1000;
}

export interface EstimateTurnCreditMicrosParams {
  promptTokens: number;
  modelConfig?: TurnCostModelConfig | null;
  outputAllowanceTokens?: number;
}

export function estimateTurnCreditMicros(params: EstimateTurnCreditMicrosParams): number {
  const outputTokens = Math.min(
    params.outputAllowanceTokens ??
      params.modelConfig?.maxTokens ??
      TURN_OUTPUT_ALLOWANCE_MAX_TOKENS,
    TURN_OUTPUT_ALLOWANCE_MAX_TOKENS,
  );
  const costMicros =
    tokenCostMicros(params.promptTokens, params.modelConfig?.costPer1kInputTokens) +
    tokenCostMicros(outputTokens, params.modelConfig?.costPer1kOutputTokens);

  return creditMicrosFromCostMicros(costMicros, DEFAULT_MARGIN);
}
