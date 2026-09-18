import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { usagePeriodFromDate, type UsageReservationKind } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";

import type { UsageReservationOutcome, UsageReservationRecord, UsageRuntime } from "./store.js";

const logger = getLogger({ prefix: "ai-billing/reservations" });

export const CHAT_RUN_RESERVATION_TTL_MS = 24 * 60 * 60 * 1000;

export function chatRunReservationExpiresAt(now = Date.now()): string {
  return new Date(now + CHAT_RUN_RESERVATION_TTL_MS).toISOString();
}

export interface HoldUsageReservationParams {
  userId: number;
  kind: UsageReservationKind;
  refId: string;
  creditMicros: number;
  expiresAt?: string | null;
}

export async function holdUsageReservation(
  runtime: UsageRuntime,
  params: HoldUsageReservationParams,
): Promise<boolean> {
  const period = usagePeriodFromDate();
  const creditMicros = Math.max(0, Math.round(params.creditMicros));

  const created = await runtime.store.createReservation({
    id: generateId(),
    userId: params.userId,
    period,
    kind: params.kind,
    refId: params.refId,
    creditMicros,
    expiresAt: params.expiresAt ?? null,
  });

  if (created && creditMicros > 0) {
    await runtime.store.applyUserBalanceDeltas({
      userId: params.userId,
      period,
      deltas: { reserved_credit_micros: creditMicros },
    });

    runtime.publisher?.usageChanged(params.userId, period);
  }

  return created;
}

export interface FinishUsageReservationParams {
  kind: UsageReservationKind;
  refId: string;
  outcome: UsageReservationOutcome;
  reservationId?: string;
}

export async function finishUsageReservation(
  runtime: UsageRuntime,
  params: FinishUsageReservationParams,
): Promise<UsageReservationRecord | null> {
  const { store, publisher } = runtime;
  const reservation = await store.getReservation(params.kind, params.refId);

  if (!reservation) {
    return null;
  }

  if (reservation.kind === "chat_run") {
    const finished = await store.finishUserReservationWithBalance(
      params.kind,
      params.refId,
      params.outcome,
      params.reservationId,
    );

    if (finished) {
      publisher?.usageChanged(finished.user_id, finished.period);
    }

    return finished;
  }

  const transitioned = await store.transitionHeldReservation(
    params.kind,
    params.refId,
    params.outcome,
  );

  if (!transitioned) {
    logger.debug("Usage reservation was already finished", {
      kind: params.kind,
      refId: params.refId,
      status: reservation.status,
    });

    return null;
  }

  if (reservation.credit_micros > 0) {
    await store.applyUserBalanceDeltas({
      userId: reservation.user_id,
      period: reservation.period,
      deltas: { reserved_credit_micros: -reservation.credit_micros },
    });

    publisher?.usageChanged(reservation.user_id, reservation.period);
  }

  return reservation;
}
