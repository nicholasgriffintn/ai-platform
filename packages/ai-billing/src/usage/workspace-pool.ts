import { usagePeriodFromDate, type UsageCreditsSummary } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import { resolveCreditState } from "../credit-state.js";
import { usageCreditsFromBalance } from "./credit-summary.js";
import {
  createDurableTurnReservation,
  type CreditPosition,
  type TurnAdmission,
} from "./credits.js";
import { currentFundingWorkspaceId } from "./funding-scope.js";
import type { UsageRuntime, UsageStore, WorkspacePoolRecord } from "./store.js";

export async function resolvePoolFunding(
  store: UsageStore,
  workspaceId: string | null | undefined,
): Promise<string | null> {
  const funding = currentFundingWorkspaceId();

  if (funding) {
    return funding;
  }

  if (!workspaceId) {
    return null;
  }

  return (await store.getWorkspacePool(workspaceId, usagePeriodFromDate())) ? workspaceId : null;
}

export function workspacePoolCredits(pool: WorkspacePoolRecord): UsageCreditsSummary {
  return usageCreditsFromBalance({ ...pool, overage_credit_micros: 0, overage_enabled: 0 });
}

function poolPosition(pool: WorkspacePoolRecord, period: string): CreditPosition {
  const position = {
    includedCreditMicros: pool.included_credit_micros,
    graceCreditMicros: pool.grace_credit_micros,
    spentCreditMicros: pool.spent_credit_micros,
    reservedCreditMicros: pool.reserved_credit_micros,
    overageEnabled: false,
  };

  return {
    ...position,
    enforced: true,
    allowanceMissing: false,
    period,
    planId: null,
    state: resolveCreditState(position),
  };
}

function missingPoolPosition(period: string): CreditPosition {
  return {
    enforced: false,
    allowanceMissing: true,
    period,
    planId: null,
    includedCreditMicros: 0,
    graceCreditMicros: 0,
    spentCreditMicros: 0,
    reservedCreditMicros: 0,
    overageEnabled: false,
    state: "exhausted",
  };
}

export async function readWorkspacePoolPosition(
  runtime: UsageRuntime,
  workspaceId: string,
  period = usagePeriodFromDate(),
): Promise<CreditPosition> {
  const pool = await runtime.store.getWorkspacePool(workspaceId, period);

  return pool ? poolPosition(pool, period) : missingPoolPosition(period);
}

export interface AdmitWorkspaceTurnParams {
  workspaceId: string;
  estimatedCreditMicros: number;
  durableReservation?: {
    kind: "chat_run";
    refId: string;
    userId: number;
    expiresAt?: string | null;
  };
}

export async function admitWorkspaceTurn(
  runtime: UsageRuntime,
  params: AdmitWorkspaceTurnParams,
): Promise<TurnAdmission> {
  const { store, publisher } = runtime;
  const { workspaceId, durableReservation } = params;
  const position = await readWorkspacePoolPosition(runtime, workspaceId);
  const creditMicros = Math.max(0, Math.round(params.estimatedCreditMicros));
  const committed = position.spentCreditMicros + position.reservedCreditMicros;
  const ceiling = position.includedCreditMicros + position.graceCreditMicros;

  if (!position.enforced || committed + creditMicros > ceiling) {
    return { admitted: false, position };
  }

  if (creditMicros === 0) {
    return { admitted: true, position, reservation: null };
  }

  if (durableReservation) {
    const reservationId = generateId();
    const created = await store.createWorkspaceReservationWithPool({
      id: reservationId,
      userId: durableReservation.userId,
      period: position.period,
      kind: durableReservation.kind,
      refId: durableReservation.refId,
      creditMicros,
      expiresAt: durableReservation.expiresAt ?? null,
      workspaceId,
    });

    if (!created) {
      return { admitted: false, position };
    }

    await publisher?.workspaceUsageChanged?.(workspaceId, position.period);

    return {
      admitted: true,
      position,
      reservation: createDurableTurnReservation(
        runtime,
        durableReservation.kind,
        durableReservation.refId,
        creditMicros,
        reservationId,
      ),
    };
  }

  if (!(await store.reserveWorkspacePool(workspaceId, position.period, creditMicros))) {
    return { admitted: false, position };
  }

  let released = false;

  return {
    admitted: true,
    position,
    reservation: {
      creditMicros,
      release: async () => {
        if (released) {
          return;
        }

        released = true;
        await store.adjustWorkspacePoolReserved(workspaceId, position.period, -creditMicros);
      },
    },
  };
}
