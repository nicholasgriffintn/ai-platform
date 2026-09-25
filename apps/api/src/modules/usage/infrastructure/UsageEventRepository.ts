import type { UsageBalanceSeed, UsageEventRecord } from "@ngriffin_uk/polychat-ai-billing";
import type {
  ComputeSite,
  UsageEventReason,
  UsageSource,
  UsageUnit,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";

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
  vendor_units: number | null;
  reason: UsageEventReason | null;
  site: ComputeSite | null;
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

export interface ChatRunUsageEventSummaryRow {
  run_id: string;
  run_attempt: number | null;
  source: UsageSource;
  event_count: number;
  cost_micros: number;
  credit_micros: number;
  estimated_price_event_count: number;
  input_tokens: number;
}

export interface ListUsageEventsParams {
  userId: number;
  period: string;
  limit: number;
  cursor?: { occurredAt: string; id: string } | null;
  source?: string | null;
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
  "run_id",
  "run_attempt",
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
  "vendor_units",
  "reason",
  "site",
  "raw",
] as const;

const RECORD_COLUMNS = `id, occurred_at, period, source, vendor, resource, unit, quantity,
	cost_micros, credit_micros, billable, byok, estimated, vendor_units, reason, site,
	conversation_id, project_id, workspace_id`;

const CREDITS_ENFORCED = "included_credit_micros > 0";

const SPEND_PAST_CEILING = `MAX(0, spent_credit_micros + ?
	- MAX(spent_credit_micros, included_credit_micros + grace_credit_micros))`;

export class UsageEventRepository extends BaseRepository {
  private buildInsert(event: UsageEventRecord): { query: string; values: unknown[] } {
    const placeholders = INSERT_COLUMNS.map(() => "?").join(", ");
    const values = INSERT_COLUMNS.map((column) => {
      const value = event[column];

      return typeof value === "boolean" ? (value ? 1 : 0) : value;
    });

    return {
      query: `INSERT INTO usage_event (${INSERT_COLUMNS.join(", ")})
			 VALUES (${placeholders})
			 ON CONFLICT (idempotency_key) DO NOTHING`,
      values,
    };
  }

  private async insertEvent(event: UsageEventRecord): Promise<boolean> {
    const insert = this.buildInsert(event);
    const result = await this.executeRun(insert.query, insert.values);

    return (result.meta?.changes ?? 0) > 0;
  }

  async insertEventAndApplyBalance(
    event: UsageEventRecord,
    seed: UsageBalanceSeed,
  ): Promise<boolean> {
    if (!event.billable || event.credit_micros === 0) {
      return this.insertEvent(event);
    }

    const database = this.env.DB;

    if (!database) {
      throw new AssistantError("Database not configured", ErrorType.CONFIGURATION_ERROR);
    }

    const inserted = await this.insertEvent(event);

    if (!inserted) {
      return false;
    }

    await database.batch([
      database
        .prepare(
          `INSERT INTO usage_balance (
				id, user_id, period, plan_id, included_credit_micros, grace_credit_micros
			 ) VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT (user_id, period) DO UPDATE SET
			   plan_id = excluded.plan_id,
			   included_credit_micros = excluded.included_credit_micros,
			   grace_credit_micros = excluded.grace_credit_micros,
			   updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(
          `${event.user_id}:${event.period}`,
          event.user_id,
          event.period,
          seed.planId,
          seed.includedCreditMicros,
          seed.graceCreditMicros,
        ),
      database
        .prepare(
          `UPDATE usage_balance
			 SET spent_credit_micros = spent_credit_micros + ?,
			     overrun_credit_micros = overrun_credit_micros
			       + CASE WHEN ${CREDITS_ENFORCED} AND overage_enabled = 0 THEN ${SPEND_PAST_CEILING} ELSE 0 END,
			     overage_credit_micros = overage_credit_micros
			       + CASE WHEN ${CREDITS_ENFORCED} AND overage_enabled = 1 THEN ${SPEND_PAST_CEILING} ELSE 0 END,
			     last_event_at = MAX(COALESCE(last_event_at, ''), ?),
			     updated_at = CURRENT_TIMESTAMP
			 WHERE user_id = ? AND period = ?`,
        )
        .bind(
          event.credit_micros,
          event.credit_micros,
          event.credit_micros,
          event.occurred_at,
          event.user_id,
          event.period,
        ),
    ]);

    return true;
  }

  async listUserEvents(params: ListUsageEventsParams): Promise<UsageEventRecordRow[]> {
    const values: unknown[] = [params.userId, params.period];
    let sourceClause = "";
    let cursorClause = "";

    if (params.source) {
      sourceClause = " AND source = ?";
      values.push(params.source);
    }

    if (params.cursor) {
      cursorClause = " AND (occurred_at < ? OR (occurred_at = ? AND id < ?))";
      values.push(params.cursor.occurredAt, params.cursor.occurredAt, params.cursor.id);
    }

    values.push(params.limit);

    return this.runQuery<UsageEventRecordRow>(
      `SELECT ${RECORD_COLUMNS}
			 FROM usage_event
			 WHERE user_id = ? AND period = ?${sourceClause}${cursorClause}
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

  async summariseWorkspacePeriodBy(
    workspaceId: string,
    period: string,
    dimension: "source" | "vendor" | "project",
  ): Promise<UsageEventGroupRow[]> {
    const column = dimension === "project" ? "COALESCE(project_id, '')" : dimension;

    return this.runQuery<UsageEventGroupRow>(
      `SELECT ${column} AS key,
              COALESCE(SUM(cost_micros), 0) AS cost_micros,
              COALESCE(SUM(credit_micros), 0) AS credit_micros,
              COUNT(*) AS event_count
       FROM usage_event
       WHERE workspace_id = ? AND period = ?
       GROUP BY ${column}
       ORDER BY credit_micros DESC, key ASC`,
      [workspaceId, period],
    );
  }

  async summariseModelUsage(input: {
    workspaceId: string;
    vendor: string;
    resources: readonly string[];
    since: string;
  }): Promise<{
    requests: number;
    input_tokens: number;
    output_tokens: number;
    cost_micros: number;
  }> {
    const placeholders = input.resources.map(() => "?").join(", ");
    const row = await this.runQuery<{
      requests: number;
      input_tokens: number;
      output_tokens: number;
      cost_micros: number;
    }>(
      `SELECT COUNT(DISTINCT COALESCE(message_id, completion_id, id)) AS requests,
              COALESCE(SUM(CASE WHEN unit LIKE '%input_tokens' THEN quantity ELSE 0 END), 0) AS input_tokens,
              COALESCE(SUM(CASE WHEN unit LIKE '%output_tokens' THEN quantity ELSE 0 END), 0) AS output_tokens,
              COALESCE(SUM(cost_micros), 0) AS cost_micros
       FROM usage_event
       WHERE workspace_id = ? AND source = 'model' AND vendor = ?
         AND resource IN (${placeholders}) AND occurred_at >= ?`,
      [input.workspaceId, input.vendor, ...input.resources, input.since],
      true,
    );

    return row ?? { requests: 0, input_tokens: 0, output_tokens: 0, cost_micros: 0 };
  }

  async summariseInfrastructureDay(
    day: string,
  ): Promise<Array<{ resource: string; unit: UsageUnit; quantity: number; cost_micros: number }>> {
    return this.runQuery(
      `SELECT resource, unit,
			        COALESCE(SUM(quantity), 0) AS quantity,
			        COALESCE(SUM(cost_micros), 0) AS cost_micros
			 FROM usage_event
			 WHERE source = 'infrastructure'
			   AND occurred_at >= ? AND occurred_at <= ?
			 GROUP BY resource, unit`,
      [`${day}T00:00:00.000Z`, `${day}T23:59:59.999Z`],
    );
  }

  async summariseChatRuns(runIds: readonly string[]): Promise<ChatRunUsageEventSummaryRow[]> {
    if (runIds.length === 0) {
      return [];
    }

    const placeholders = runIds.map(() => "?").join(", ");

    return this.runQuery<ChatRunUsageEventSummaryRow>(
      `SELECT run_id, run_attempt, source,
              COUNT(*) AS event_count,
              COALESCE(SUM(cost_micros), 0) AS cost_micros,
              COALESCE(SUM(credit_micros), 0) AS credit_micros,
              COALESCE(SUM(CASE WHEN estimated = 1 THEN 1 ELSE 0 END), 0)
                AS estimated_price_event_count,
              COALESCE(SUM(CASE WHEN unit LIKE '%input_tokens'
                THEN quantity ELSE 0 END), 0) AS input_tokens
       FROM usage_event
       WHERE run_id IN (${placeholders})
       GROUP BY run_id, run_attempt, source
       ORDER BY run_id ASC, run_attempt ASC, source ASC`,
      [...runIds],
    );
  }
}
