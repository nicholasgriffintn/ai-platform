import { usagePeriodFromDate, type UsageReservationKind } from "@ngriffin_uk/polychat-schemas";

import type { RepositoryManager } from "~/repositories";
import type { UsageReservationRow } from "~/repositories/UsageReservationRepository";
import { publishUserEvent } from "~/services/sync/conversation-events";
import type { SyncPublisher } from "~/services/sync/publish";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/usage/reservations" });

export const CHAT_RUN_RESERVATION_TTL_MS = 24 * 60 * 60 * 1000;

export function chatRunReservationExpiresAt(now = Date.now()): string {
  return new Date(now + CHAT_RUN_RESERVATION_TTL_MS).toISOString();
}

export interface HoldUsageReservationParams {
  repositories: RepositoryManager;
  userId: number;
  kind: UsageReservationKind;
  refId: string;
  creditMicros: number;
  expiresAt?: string | null;
  publisher?: SyncPublisher;
}

export async function holdUsageReservation(params: HoldUsageReservationParams): Promise<boolean> {
  const period = usagePeriodFromDate();
  const creditMicros = Math.max(0, Math.round(params.creditMicros));

  const created = await params.repositories.usageReservations.createReservation({
    id: generateId(),
    userId: params.userId,
    period,
    kind: params.kind,
    refId: params.refId,
    creditMicros,
    expiresAt: params.expiresAt ?? null,
  });

  if (created && creditMicros > 0) {
    await params.repositories.usageBalances.applyDeltas({
      userId: params.userId,
      period,
      deltas: { reserved_credit_micros: creditMicros },
    });

    if (params.publisher) {
      publishUserEvent(params.publisher, params.userId, "usage.changed", { period });
    }
  }

  return created;
}

export interface FinishUsageReservationParams {
  repositories: RepositoryManager;
  kind: UsageReservationKind;
  refId: string;
  outcome: "settled" | "released";
  reservationId?: string;
  publisher?: SyncPublisher;
}

export async function finishUsageReservation(
  params: FinishUsageReservationParams,
): Promise<UsageReservationRow | null> {
  const reservation = await params.repositories.usageReservations.getReservation(
    params.kind,
    params.refId,
  );

  if (!reservation) {
    return null;
  }

  if (reservation.kind === "chat_run") {
    const finished = await params.repositories.usageReservations.finishUserReservationWithBalance(
      params.kind,
      params.refId,
      params.outcome,
      params.reservationId,
    );

    if (finished && params.publisher) {
      publishUserEvent(params.publisher, finished.user_id, "usage.changed", {
        period: finished.period,
      });
    }

    return finished;
  }

  const transitioned = await params.repositories.usageReservations.transitionHeldReservation(
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
    await params.repositories.usageBalances.applyDeltas({
      userId: reservation.user_id,
      period: reservation.period,
      deltas: { reserved_credit_micros: -reservation.credit_micros },
    });

    if (params.publisher) {
      publishUserEvent(params.publisher, reservation.user_id, "usage.changed", {
        period: reservation.period,
      });
    }
  }

  return reservation;
}
