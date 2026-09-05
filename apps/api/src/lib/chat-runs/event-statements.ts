import {
  CHAT_RUN_EVENT_PROTOCOL_VERSION,
  CHAT_RUN_EVENT_RETENTION_LIMIT,
} from "@ngriffin_uk/polychat-schemas";

export interface RunEventWrite {
  id: string;
  runId: string;
  type: string;
  occurredAt: string;
  data: Record<string, unknown>;
  expectedAttempt?: number;
}

export function buildAdvanceRunEventSequenceStatement(
  database: D1Database,
  event: RunEventWrite,
): D1PreparedStatement {
  const attemptClause = event.expectedAttempt === undefined ? "" : " AND attempt = ?";

  return database
    .prepare(
      `UPDATE conversation_run
       SET event_sequence = event_sequence + 1
       WHERE id = ?${attemptClause}`,
    )
    .bind(event.runId, ...(event.expectedAttempt === undefined ? [] : [event.expectedAttempt]));
}

export function buildInsertRunEventStatement(
  database: D1Database,
  event: RunEventWrite,
): D1PreparedStatement {
  const attemptClause = event.expectedAttempt === undefined ? "" : " AND attempt = ?";

  return database
    .prepare(
      `INSERT INTO conversation_run_event (
         id, run_id, sequence, protocol_version, attempt, type, occurred_at, data
       )
       SELECT ?, id, event_sequence, ?, attempt, ?, ?, ?
       FROM conversation_run
       WHERE id = ? AND event_sequence > 0${attemptClause}`,
    )
    .bind(
      event.id,
      CHAT_RUN_EVENT_PROTOCOL_VERSION,
      event.type,
      event.occurredAt,
      JSON.stringify(event.data),
      event.runId,
      ...(event.expectedAttempt === undefined ? [] : [event.expectedAttempt]),
    );
}

export function buildInsertRetryRunEventStatement(
  database: D1Database,
  event: RunEventWrite & { expectedAttempt: number },
  retryJson: string | null,
): D1PreparedStatement {
  return database
    .prepare(
      `INSERT INTO conversation_run_event (
         id, run_id, sequence, protocol_version, attempt, type, occurred_at, data
       )
       SELECT ?, id, event_sequence, ?, attempt, ?, ?, ?
       FROM conversation_run
       WHERE id = ? AND attempt = ? AND status = 'running'
         AND retry_json IS ? AND event_sequence > 0`,
    )
    .bind(
      event.id,
      CHAT_RUN_EVENT_PROTOCOL_VERSION,
      event.type,
      event.occurredAt,
      JSON.stringify(event.data),
      event.runId,
      event.expectedAttempt,
      retryJson,
    );
}

export function buildTrimRunEventsStatement(
  database: D1Database,
  runId: string,
): D1PreparedStatement {
  return database
    .prepare(
      `DELETE FROM conversation_run_event
       WHERE run_id = ?
         AND sequence <= (
           SELECT event_sequence - ? FROM conversation_run WHERE id = ?
         )`,
    )
    .bind(runId, CHAT_RUN_EVENT_RETENTION_LIMIT, runId);
}

export function buildAppendRunEventStatements(
  database: D1Database,
  event: RunEventWrite,
): D1PreparedStatement[] {
  return [
    buildAdvanceRunEventSequenceStatement(database, event),
    buildInsertRunEventStatement(database, event),
    buildTrimRunEventsStatement(database, event.runId),
  ];
}
