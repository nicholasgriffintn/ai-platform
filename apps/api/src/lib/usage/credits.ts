import {
  creditMicrosFromCostMicros,
  creditMicrosFromCredits,
  creditsFromCreditMicros,
  DEFAULT_MARGIN,
  usagePeriodFromDate,
  type CreditState,
  type ModelConfigItem,
  type UsageCreditsSummary,
} from "@ngriffin_uk/polychat-schemas";

import type { RepositoryManager } from "~/repositories";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/usage/credits" });

const GRACE_INCLUDED_FRACTION = 0.1;
const GRACE_FLOOR_CREDIT_MICROS = creditMicrosFromCredits(50);
const OVERRUN_CAP_GRACE_FRACTION = 0.25;
const OVERRUN_CAP_FLOOR_CREDIT_MICROS = creditMicrosFromCredits(25);

export const TURN_OUTPUT_ALLOWANCE_MAX_TOKENS = 8192;

export interface CreditStateInput {
  includedCreditMicros: number;
  graceCreditMicros: number;
  spentCreditMicros: number;
  reservedCreditMicros: number;
  overageEnabled: boolean;
}

export function resolveCreditState(input: CreditStateInput): CreditState {
  const committed = input.spentCreditMicros + input.reservedCreditMicros;

  if (committed < input.includedCreditMicros) {
    return "ok";
  }

  if (committed < input.includedCreditMicros + input.graceCreditMicros) {
    return "reserve";
  }

  return input.overageEnabled ? "overage" : "exhausted";
}

export function defaultGraceCreditMicros(includedCreditMicros: number): number {
  return Math.max(
    Math.round(includedCreditMicros * GRACE_INCLUDED_FRACTION),
    GRACE_FLOOR_CREDIT_MICROS,
  );
}

export function overrunCapCreditMicros(graceCreditMicros: number): number {
  return Math.max(
    Math.round(graceCreditMicros * OVERRUN_CAP_GRACE_FRACTION),
    OVERRUN_CAP_FLOOR_CREDIT_MICROS,
  );
}

export interface PlanCreditAllowance {
  planId: string | null;
  configured: boolean;
  includedCreditMicros: number;
  graceCreditMicros: number;
}

const UNCONFIGURED_ALLOWANCE: Omit<PlanCreditAllowance, "planId"> = {
  configured: false,
  includedCreditMicros: 0,
  graceCreditMicros: 0,
};

export async function readPlanCreditAllowance(
  repositories: RepositoryManager,
  planId: string | null | undefined,
): Promise<PlanCreditAllowance> {
  if (!planId) {
    return { planId: null, ...UNCONFIGURED_ALLOWANCE };
  }

  const plan = await repositories.plans.getPlanById(planId);
  const includedCredits = plan?.included_credits;

  if (typeof includedCredits !== "number") {
    return { planId, ...UNCONFIGURED_ALLOWANCE };
  }

  const includedCreditMicros = creditMicrosFromCredits(includedCredits);
  const graceCredits = plan?.grace_credits;

  return {
    planId,
    configured: true,
    includedCreditMicros,
    graceCreditMicros:
      typeof graceCredits === "number"
        ? creditMicrosFromCredits(graceCredits)
        : defaultGraceCreditMicros(includedCreditMicros),
  };
}

export interface CreditSnapshot {
  configured: boolean;
  period: string;
  planId: string | null;
  includedCreditMicros: number;
  graceCreditMicros: number;
  spentCreditMicros: number;
  reservedCreditMicros: number;
  overrunCreditMicros: number;
  overageCreditMicros: number;
  overageEnabled: boolean;
  state: CreditState;
}

export interface ReadCreditSnapshotParams {
  repositories: RepositoryManager;
  userId: number;
  planId?: string | null;
  period?: string;
}

export async function readCreditSnapshot(
  params: ReadCreditSnapshotParams,
): Promise<CreditSnapshot> {
  const period = params.period ?? usagePeriodFromDate();
  const allowance = await readPlanCreditAllowance(params.repositories, params.planId);

  if (!allowance.configured) {
    return {
      configured: false,
      period,
      planId: allowance.planId,
      includedCreditMicros: 0,
      graceCreditMicros: 0,
      spentCreditMicros: 0,
      reservedCreditMicros: 0,
      overrunCreditMicros: 0,
      overageCreditMicros: 0,
      overageEnabled: false,
      state: "ok",
    };
  }

  const balance = await params.repositories.usageBalances.getBalance(params.userId, period);
  const spentCreditMicros = balance?.spent_credit_micros ?? 0;
  const reservedCreditMicros = balance?.reserved_credit_micros ?? 0;
  const overageEnabled = Boolean(balance?.overage_enabled);

  return {
    configured: allowance.configured,
    period,
    planId: allowance.planId,
    includedCreditMicros: allowance.includedCreditMicros,
    graceCreditMicros: allowance.graceCreditMicros,
    spentCreditMicros,
    reservedCreditMicros,
    overrunCreditMicros: balance?.overrun_credit_micros ?? 0,
    overageCreditMicros: balance?.overage_credit_micros ?? 0,
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

export function creditsSummary(snapshot: CreditSnapshot): UsageCreditsSummary {
  return {
    included: creditsFromCreditMicros(snapshot.includedCreditMicros),
    used: creditsFromCreditMicros(snapshot.spentCreditMicros),
    reserved: creditsFromCreditMicros(snapshot.reservedCreditMicros),
    grace: creditsFromCreditMicros(snapshot.graceCreditMicros),
    overrun: creditsFromCreditMicros(snapshot.overrunCreditMicros),
    overage: creditsFromCreditMicros(snapshot.overageCreditMicros),
    overage_enabled: snapshot.overageEnabled,
    state: snapshot.state,
  };
}

export function shouldStopRunaway(credits: UsageCreditsSummary): boolean {
  const includedCreditMicros = creditMicrosFromCredits(credits.included);
  const graceCreditMicros = creditMicrosFromCredits(credits.grace);
  const spentCreditMicros = creditMicrosFromCredits(credits.used);

  return (
    spentCreditMicros >
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

export interface TurnReservation {
  creditMicros: number;
  release(): Promise<void>;
}

export type TurnAdmission =
  | { admitted: true; snapshot: CreditSnapshot; reservation: TurnReservation | null }
  | { admitted: false; snapshot: CreditSnapshot };

export interface AdmitTurnParams extends ReadCreditSnapshotParams {
  estimatedCreditMicros: number;
}

function createTurnReservation(
  repositories: RepositoryManager,
  userId: number,
  period: string,
  creditMicros: number,
): TurnReservation {
  let released = false;

  return {
    creditMicros,
    release: async () => {
      if (released || creditMicros <= 0) {
        released = true;

        return;
      }

      released = true;

      try {
        await repositories.usageBalances.applyDeltas({
          userId,
          period,
          deltas: { reserved_credit_micros: -creditMicros },
        });
      } catch (error) {
        logger.error("Failed to release a turn reservation", { error, userId, period });
      }
    },
  };
}

export async function admitTurn(params: AdmitTurnParams): Promise<TurnAdmission> {
  const snapshot = await readCreditSnapshot(params);

  if (!snapshot.configured) {
    return { admitted: true, snapshot, reservation: null };
  }

  const committed = snapshot.spentCreditMicros + snapshot.reservedCreditMicros;
  const ceiling = snapshot.includedCreditMicros + snapshot.graceCreditMicros;
  const fits = committed + params.estimatedCreditMicros <= ceiling;

  if (!fits && !snapshot.overageEnabled) {
    return { admitted: false, snapshot };
  }

  await params.repositories.usageBalances.ensureBalance({
    userId: params.userId,
    period: snapshot.period,
    planId: snapshot.planId,
    includedCreditMicros: snapshot.includedCreditMicros,
    graceCreditMicros: snapshot.graceCreditMicros,
  });

  if (params.estimatedCreditMicros > 0) {
    await params.repositories.usageBalances.applyDeltas({
      userId: params.userId,
      period: snapshot.period,
      planId: snapshot.planId,
      includedCreditMicros: snapshot.includedCreditMicros,
      graceCreditMicros: snapshot.graceCreditMicros,
      deltas: { reserved_credit_micros: params.estimatedCreditMicros },
    });
  }

  return {
    admitted: true,
    snapshot,
    reservation: createTurnReservation(
      params.repositories,
      params.userId,
      snapshot.period,
      params.estimatedCreditMicros,
    ),
  };
}
