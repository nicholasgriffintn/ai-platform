import type { UsageSource, UsageUnit } from "@ngriffin_uk/polychat-schemas";

import { BaseRepository } from "./BaseRepository";

export interface UsageEventInsert {
  id: string;
  idempotency_key: string;
  user_id: number;
  workspace_id: string | null;
  project_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  activity_id: string | null;
  completion_id: string | null;
  occurred_at: string;
  period: string;
  source: UsageSource;
  vendor: string;
  resource: string;
  unit: UsageUnit;
  quantity: number;
  rate_version: string | null;
  unit_cost_micros: number | null;
  cost_micros: number;
  credit_micros: number;
  billable: boolean;
  byok: boolean;
  estimated: boolean;
  raw: string | null;
}

export interface UsageEventRecordRow {
  id: string;
  occurred_at: string;
  period: string;
  source: UsageSource;
  vendor: string;
  resource: string;
  unit: UsageUnit;
  quantity: number;
  cost_micros: number;
  credit_micros: number;
  billable: number;
  byok: number;
  estimated: number;
  conversation_id: string | null;
  project_id: string | null;
  workspace_id: string | null;
}

export interface UsageEventGroupRow {
  key: string;
  cost_micros: number;
  credit_micros: number;
  event_count: number;
}

export interface ListUsageEventsParams {
  userId: number;
  period: string;
  limit: number;
  cursor?: { occurredAt: string; id: string } | null;
}

const INSERT_COLUMNS = [
  "id",
  "idempotency_key",
  "user_id",
  "workspace_id",
  "project_id",
  "conversation_id",
  "message_id",
  "activity_id",
  "completion_id",
  "occurred_at",
  "period",
  "source",
  "vendor",
  "resource",
  "unit",
  "quantity",
  "rate_version",
  "unit_cost_micros",
  "cost_micros",
  "credit_micros",
  "billable",
  "byok",
  "estimated",
  "raw",
] as const;

const RECORD_COLUMNS = `id, occurred_at, period, source, vendor, resource, unit, quantity,
	cost_micros, credit_micros, billable, byok, estimated, conversation_id, project_id, workspace_id`;

export class UsageEventRepository extends BaseRepository {
  async insertEvent(event: UsageEventInsert): Promise<boolean> {
    const placeholders = INSERT_COLUMNS.map(() => "?").join(", ");
    const values = INSERT_COLUMNS.map((column) => {
      const value = event[column];

      return typeof value === "boolean" ? (value ? 1 : 0) : value;
    });

    const result = await this.executeRun(
      `INSERT INTO usage_event (${INSERT_COLUMNS.join(", ")})
			 VALUES (${placeholders})
			 ON CONFLICT (idempotency_key) DO NOTHING`,
      values,
    );

    return (result.meta?.changes ?? 0) > 0;
  }

  async insertEvents(events: readonly UsageEventInsert[]): Promise<number> {
    let inserted = 0;

    for (const event of events) {
      if (await this.insertEvent(event)) {
        inserted += 1;
      }
    }

    return inserted;
  }

  async listUserEvents(params: ListUsageEventsParams): Promise<UsageEventRecordRow[]> {
    const values: unknown[] = [params.userId, params.period];
    let cursorClause = "";

    if (params.cursor) {
      cursorClause = " AND (occurred_at < ? OR (occurred_at = ? AND id < ?))";
      values.push(params.cursor.occurredAt, params.cursor.occurredAt, params.cursor.id);
    }

    values.push(params.limit);

    return this.runQuery<UsageEventRecordRow>(
      `SELECT ${RECORD_COLUMNS}
			 FROM usage_event
			 WHERE user_id = ? AND period = ?${cursorClause}
			 ORDER BY occurred_at DESC, id DESC
			 LIMIT ?`,
      values,
    );
  }

  async summariseUserPeriodBy(
    userId: number,
    period: string,
    dimension: "source" | "vendor",
  ): Promise<UsageEventGroupRow[]> {
    const column = dimension === "source" ? "source" : "vendor";

    return this.runQuery<UsageEventGroupRow>(
      `SELECT ${column} AS key,
			        COALESCE(SUM(cost_micros), 0) AS cost_micros,
			        COALESCE(SUM(credit_micros), 0) AS credit_micros,
			        COUNT(*) AS event_count
			 FROM usage_event
			 WHERE user_id = ? AND period = ?
			 GROUP BY ${column}
			 ORDER BY credit_micros DESC`,
      [userId, period],
    );
  }
}
