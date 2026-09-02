import {
  creditMicrosFromCostMicros,
  creditMicrosFromCredits,
  DEFAULT_MARGIN,
  usagePeriodFromDate,
  type CreditState,
  type ModelConfigItem,
  type UsageCreditsSummary,
} from "@ngriffin_uk/polychat-schemas";

import type { RepositoryManager } from "~/repositories";
import { getLogger } from "~/utils/logger";

import {
  applyActorCreditDeltas,
  defaultActorPlanId,
  readActorCreditSpend,
  type CreditActor,
} from "./creditActor";
import { resolveCreditState } from "./creditState";
import { creditsAreEnforced, resolvePlanCreditAllowance } from "./planSeed";

const logger = getLogger({ prefix: "lib/usage/credits" });

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

export interface CreditPosition {
  enforced: boolean;
  allowanceMissing?: boolean;
  period: string;
  planId: string | null;
  includedCreditMicros: number;
  graceCreditMicros: number;
  spentCreditMicros: number;
  reservedCreditMicros: number;
  overageEnabled: boolean;
  state: CreditState;
}

export interface ReadCreditPositionParams {
  repositories: RepositoryManager;
  actor: CreditActor;
  planId?: string | null;
  period?: string;
}

export async function readCreditPosition(
  params: ReadCreditPositionParams,
): Promise<CreditPosition> {
  const period = params.period ?? usagePeriodFromDate();
  const allowance = await resolvePlanCreditAllowance(
    params.repositories,
    defaultActorPlanId(params.actor, params.planId),
  );

  if (!creditsAreEnforced(allowance)) {
    return {
      enforced: false,
      allowanceMissing: true,
      period,
      planId: allowance.planId,
      includedCreditMicros: 0,
      graceCreditMicros: 0,
      spentCreditMicros: 0,
      reservedCreditMicros: 0,
      overageEnabled: false,
      state: "exhausted",
    };
  }

  const spend = await readActorCreditSpend(params.repositories, params.actor, period);
  const spentCreditMicros = spend.spentCreditMicros;
  const reservedCreditMicros = spend.reservedCreditMicros;
  const overageEnabled = spend.overageEnabled;

  return {
    enforced: true,
    allowanceMissing: false,
    period,
    planId: allowance.planId,
    includedCreditMicros: allowance.includedCreditMicros,
    graceCreditMicros: allowance.graceCreditMicros,
    spentCreditMicros,
    reservedCreditMicros,
    overageEnabled,
    state: resolveCreditState({
      includedCreditMicros: allowance.includedCreditMicros,
      graceCreditMicros: allowance.graceCreditMicros,
      spentCreditMicros,
      reservedCreditMicros,
      overageEnabled,
    }),
  };
}

export interface TurnReservation {
  creditMicros: number;
  release(): Promise<void>;
}

export type TurnAdmission =
  | { admitted: true; position: CreditPosition; reservation: TurnReservation | null }
  | { admitted: false; position: CreditPosition };

export interface AdmitTurnParams extends ReadCreditPositionParams {
  estimatedCreditMicros: number;
}

function createTurnReservation(
  repositories: RepositoryManager,
  actor: CreditActor,
  period: string,
  creditMicros: number,
): TurnReservation {
  let released = false;

  return {
    creditMicros,
    release: async () => {
      if (released) {
        return;
      }

      released = true;

      try {
        await applyActorCreditDeltas({
          repositories,
          actor,
          period,
          deltas: { reserved_credit_micros: -creditMicros },
        });
      } catch (error) {
        logger.error("Failed to release a turn reservation", { error, actor, period });
      }
    },
  };
}

export async function admitTurn(params: AdmitTurnParams): Promise<TurnAdmission> {
  const position = await readCreditPosition(params);

  if (!position.enforced) {
    return { admitted: false, position };
  }

  const committed = position.spentCreditMicros + position.reservedCreditMicros;
  const ceiling = position.includedCreditMicros + position.graceCreditMicros;
  const fits = committed + params.estimatedCreditMicros <= ceiling;

  if (!fits && !position.overageEnabled) {
    return { admitted: false, position };
  }

  if (params.estimatedCreditMicros <= 0) {
    return { admitted: true, position, reservation: null };
  }

  await applyActorCreditDeltas({
    repositories: params.repositories,
    actor: params.actor,
    period: position.period,
    planId: position.planId,
    includedCreditMicros: position.includedCreditMicros,
    graceCreditMicros: position.graceCreditMicros,
    deltas: { reserved_credit_micros: params.estimatedCreditMicros },
  });

  return {
    admitted: true,
    position,
    reservation: createTurnReservation(
      params.repositories,
      params.actor,
      position.period,
      params.estimatedCreditMicros,
    ),
  };
}
