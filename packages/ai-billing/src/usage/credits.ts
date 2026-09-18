import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { usagePeriodFromDate, type CreditState } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";

import { resolveCreditState } from "../credit-state.js";
import {
  applyActorCreditDeltas,
  defaultActorPlanId,
  readActorCreditSpend,
  type CreditActor,
} from "./credit-actor.js";
import { creditsAreEnforced, resolvePlanCreditAllowance } from "./plan-seed.js";
import { finishUsageReservation } from "./reservations.js";
import type { UsageRuntime } from "./store.js";

const logger = getLogger({ prefix: "ai-billing/credits" });

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
  actor: CreditActor;
  planId?: string | null;
  period?: string;
}

export async function readCreditPosition(
  runtime: UsageRuntime,
  params: ReadCreditPositionParams,
): Promise<CreditPosition> {
  const period = params.period ?? usagePeriodFromDate();
  const allowance = await resolvePlanCreditAllowance(
    runtime.store,
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

  const spend = await readActorCreditSpend(runtime.store, params.actor, period);

  return {
    enforced: true,
    allowanceMissing: false,
    period,
    planId: allowance.planId,
    includedCreditMicros: allowance.includedCreditMicros,
    graceCreditMicros: allowance.graceCreditMicros,
    spentCreditMicros: spend.spentCreditMicros,
    reservedCreditMicros: spend.reservedCreditMicros,
    overageEnabled: spend.overageEnabled,
    state: resolveCreditState({
      includedCreditMicros: allowance.includedCreditMicros,
      graceCreditMicros: allowance.graceCreditMicros,
      spentCreditMicros: spend.spentCreditMicros,
      reservedCreditMicros: spend.reservedCreditMicros,
      overageEnabled: spend.overageEnabled,
    }),
  };
}

export interface TurnReservation {
  creditMicros: number;
  release(outcome?: "settled" | "released"): Promise<void>;
}

export type TurnAdmission =
  | { admitted: true; position: CreditPosition; reservation: TurnReservation | null }
  | { admitted: false; position: CreditPosition };

export interface AdmitTurnParams extends ReadCreditPositionParams {
  estimatedCreditMicros: number;
  durableReservation?: {
    kind: "chat_run";
    refId: string;
    userId: number;
    expiresAt?: string | null;
  };
}

function createTurnReservation(
  runtime: UsageRuntime,
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
        await applyActorCreditDeltas(runtime.store, {
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

function createDurableTurnReservation(
  runtime: UsageRuntime,
  kind: "chat_run",
  refId: string,
  creditMicros: number,
  reservationId: string,
): TurnReservation {
  let finished = false;

  return {
    creditMicros,
    release: async (outcome = "released") => {
      if (finished) {
        return;
      }

      finished = true;
      await finishUsageReservation(runtime, { kind, refId, outcome, reservationId });
    },
  };
}

export async function admitTurn(
  runtime: UsageRuntime,
  params: AdmitTurnParams,
): Promise<TurnAdmission> {
  const position = await readCreditPosition(runtime, params);

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

  if (params.durableReservation) {
    const durable = params.durableReservation;
    const reservationId = generateId();
    const created = await runtime.store.createUserReservationWithBalance({
      id: reservationId,
      userId: durable.userId,
      period: position.period,
      kind: durable.kind,
      refId: durable.refId,
      creditMicros: params.estimatedCreditMicros,
      expiresAt: durable.expiresAt ?? null,
      planId: position.planId,
      includedCreditMicros: position.includedCreditMicros,
      graceCreditMicros: position.graceCreditMicros,
    });

    if (!created) {
      return { admitted: false, position };
    }

    runtime.publisher?.usageChanged(durable.userId, position.period);

    return {
      admitted: true,
      position,
      reservation: createDurableTurnReservation(
        runtime,
        durable.kind,
        durable.refId,
        params.estimatedCreditMicros,
        reservationId,
      ),
    };
  }

  await applyActorCreditDeltas(runtime.store, {
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
      runtime,
      params.actor,
      position.period,
      params.estimatedCreditMicros,
    ),
  };
}
