import type { ChatRun, ChatRunUsage, UsageSource } from "@ngriffin_uk/polychat-schemas";

import type { RepositoryManager } from "~/repositories";
import type { ChatRunUsageEventSummaryRow } from "~/repositories/UsageEventRepository";
import type { UsageReservationRow } from "~/repositories/UsageReservationRepository";

function sum(rows: readonly ChatRunUsageEventSummaryRow[], key: "cost_micros" | "credit_micros") {
  return rows.reduce((total, row) => total + row[key], 0);
}

function attemptMeasurement(params: {
  hasEvents: boolean;
  contextSource: "reported" | "estimated" | null;
}): ChatRunUsage["measurement"] {
  if (params.hasEvents && params.contextSource === "estimated") {
    return "mixed";
  }

  if (params.hasEvents || params.contextSource === "reported") {
    return "reported";
  }

  return params.contextSource ?? "unknown";
}

export function buildChatRunUsage(
  run: ChatRun,
  rows: readonly ChatRunUsageEventSummaryRow[],
  reservation: UsageReservationRow | null,
): ChatRunUsage {
  const runRows = rows.filter((row) => row.run_id === run.id);
  const attemptSummaries = Array.from({ length: run.attempt }, (_, index) => index + 1).map(
    (attempt) => {
      const attemptRows = runRows.filter((row) => row.run_attempt === attempt);
      const context = run.context?.attempt === attempt ? run.context : null;
      const hasEvents = attemptRows.length > 0;

      return {
        attempt,
        measurement: attemptMeasurement({
          hasEvents,
          contextSource: context?.usage.source ?? null,
        }),
        inputTokens:
          attemptRows.length > 0
            ? Math.round(attemptRows.reduce((total, row) => total + row.input_tokens, 0))
            : (context?.usage.inputTokens ?? null),
        eventCount: attemptRows.reduce((total, row) => total + row.event_count, 0),
        costMicros: hasEvents ? sum(attemptRows, "cost_micros") : null,
        creditMicros: hasEvents ? sum(attemptRows, "credit_micros") : null,
        estimatedPriceEventCount: attemptRows.reduce(
          (total, row) => total + row.estimated_price_event_count,
          0,
        ),
      };
    },
  );

  const bySource = new Map<UsageSource, ChatRunUsage["consumption"]["bySource"][number]>();

  for (const row of runRows) {
    const existing = bySource.get(row.source) ?? {
      source: row.source,
      eventCount: 0,
      costMicros: 0,
      creditMicros: 0,
      estimatedPriceEventCount: 0,
    };

    existing.eventCount += row.event_count;
    existing.costMicros += row.cost_micros;
    existing.creditMicros += row.credit_micros;
    existing.estimatedPriceEventCount += row.estimated_price_event_count;
    bySource.set(row.source, existing);
  }

  const eventCount = runRows.reduce((total, row) => total + row.event_count, 0);
  const measurement = attemptSummaries.some((attempt) => attempt.measurement === "mixed")
    ? "mixed"
    : attemptSummaries.some((attempt) => attempt.measurement === "reported") &&
        attemptSummaries.some((attempt) => attempt.measurement === "estimated")
      ? "mixed"
      : attemptSummaries.some((attempt) => attempt.measurement === "reported")
        ? "reported"
        : attemptSummaries.some((attempt) => attempt.measurement === "estimated")
          ? "estimated"
          : "unknown";
  const settlementStatus =
    reservation?.status === "settled"
      ? "settled"
      : reservation?.status === "released"
        ? "released"
        : reservation
          ? "pending"
          : "missing";

  return {
    protocolVersion: 1,
    runId: run.id,
    currentAttempt: run.attempt,
    measurement,
    reservation: reservation
      ? {
          creditMicros: reservation.credit_micros,
          status: reservation.status,
          expiresAt: reservation.expires_at,
          createdAt: reservation.created_at,
          updatedAt: reservation.updated_at,
        }
      : null,
    consumption: {
      status:
        eventCount > 0 ? "recorded" : reservation?.status === "settled" ? "processing" : "unknown",
      eventCount,
      costMicros: eventCount > 0 ? sum(runRows, "cost_micros") : null,
      creditMicros: eventCount > 0 ? sum(runRows, "credit_micros") : null,
      estimatedPriceEventCount: runRows.reduce(
        (total, row) => total + row.estimated_price_event_count,
        0,
      ),
      bySource: [...bySource.values()],
    },
    attempts: attemptSummaries,
    settlement: {
      status: settlementStatus,
      at:
        reservation && (reservation.status === "settled" || reservation.status === "released")
          ? reservation.updated_at
          : null,
    },
  };
}

export async function hydrateChatRunUsage(
  repositories: RepositoryManager,
  runs: readonly ChatRun[],
): Promise<ChatRun[]> {
  if (runs.length === 0) {
    return [];
  }

  const runIds = runs.map((run) => run.id);
  const [rows, reservations] = await Promise.all([
    repositories.usageEvents.summariseChatRuns(runIds),
    repositories.usageReservations.listReservations("chat_run", runIds),
  ]);
  const reservationsByRun = new Map(
    reservations.map((reservation) => [reservation.ref_id, reservation]),
  );

  return runs.map((run) => ({
    ...run,
    usage: buildChatRunUsage(run, rows, reservationsByRun.get(run.id) ?? null),
  }));
}
