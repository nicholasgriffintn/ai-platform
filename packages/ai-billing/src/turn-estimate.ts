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

const LIKELY_AGENT_STEPS = 4;
const LIKELY_STEP_OUTPUT_TOKENS = 1024;
const STEP_TOOL_RESULT_TOKENS = 1500;

export interface EstimateRunCreditMicrosParams {
  promptTokens: number;
  modelConfig?: TurnCostModelConfig | null;
  maxSteps: number;
  multiStep: boolean;
}

export interface RunCreditEstimate {
  stepCreditMicros: number;
  likelySteps: number;
  likelyCreditMicros: number;
  ceilingCreditMicros: number;
}

function sumStepEstimates(
  params: EstimateRunCreditMicrosParams,
  steps: number,
  outputTokens: number,
): number {
  let total = 0;

  for (let step = 0; step < steps; step += 1) {
    total += estimateTurnCreditMicros({
      promptTokens: params.promptTokens + step * (outputTokens + STEP_TOOL_RESULT_TOKENS),
      modelConfig: params.modelConfig,
      outputAllowanceTokens: outputTokens,
    });
  }

  return total;
}

export function estimateRunCreditMicros(params: EstimateRunCreditMicrosParams): RunCreditEstimate {
  const maxSteps = Math.max(1, params.maxSteps);
  const likelySteps = params.multiStep ? Math.min(maxSteps, LIKELY_AGENT_STEPS) : 1;
  const stepOutputCeiling = Math.min(
    params.modelConfig?.maxTokens ?? TURN_OUTPUT_ALLOWANCE_MAX_TOKENS,
    TURN_OUTPUT_ALLOWANCE_MAX_TOKENS,
  );

  return {
    stepCreditMicros: estimateTurnCreditMicros(params),
    likelySteps,
    likelyCreditMicros: sumStepEstimates(params, likelySteps, LIKELY_STEP_OUTPUT_TOKENS),
    ceilingCreditMicros: sumStepEstimates(params, maxSteps, stepOutputCeiling),
  };
}
