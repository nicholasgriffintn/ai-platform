import type {
  RunChargeGroup,
  RunChargeState,
  UsageBalanceSeed,
  UsageEventRecord,
} from "@ngriffin_uk/polychat-ai-billing";
import type {
  ComputeSite,
  UsageEventReason,
  UsageSource,
  UsageUnit,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";

import { POOL_CEILING } from "./WorkspacePoolRepository";

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
  refunded_credit_micros: number;
  absorbed_credit_micros: number;
}

export interface RunSpendSummaryRow {
  credit_micros: number;
  cost_micros: number;
  run_count: number;
}

export interface ListUsageEventsParams {
  userId: number;
  period: string;
  limit: number;
  after?: string | null;
  source?: string | null;
}

const INSERT_COLUMNS = [
  "id",
  "idempotency_key",
  "user_id",
  "workspace_id",
  "pool_workspace_id",
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

const EVENT_NOT_RECORDED = "NOT EXISTS (SELECT 1 FROM usage_event WHERE idempotency_key = ?)";

const SPEND_PAST_CEILING = `MAX(0, spent_credit_micros + ?
	- MAX(spent_credit_micros, included_credit_micros + grace_credit_micros))`;

const SPEND_RETURNED_FROM_PAST_CEILING = `MIN(?, MAX(0, spent_credit_micros
	- included_credit_micros - grace_credit_micros))`;

const RUN_CHARGE_UNCHANGED = `(SELECT COALESCE(SUM(credit_micros), 0) FROM usage_event
	WHERE run_id = ? AND billable = 1) = ?`;

const POOL_SPEND_PAST_CEILING = `MAX(0, spent_credit_micros + ?
	- MAX(spent_credit_micros, COALESCE(${POOL_CEILING}, 0)))`;

const POOL_SPEND_RETURNED_FROM_PAST_CEILING = `MIN(?, MAX(0, spent_credit_micros
	- COALESCE(${POOL_CEILING}, 0)))`;

export class UsageEventRepository extends BaseRepository {
  private buildInsert(event: UsageEventRecord): { query: string; values: unknown[] } {
    const placeholders = INSERT_COLUMNS.map(() => "?").join(", ");
    const values = INSERT_COLUMNS.map((column) => {
      const value = event[column];

      return typeof value === "boolean" ? (value ? 1 : 0) : (value ?? null);
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

    const insert = this.buildInsert(event);
    const results = await this.executeBatch([
      database
        .prepare(
          `INSERT INTO usage_balance (
				id, user_id, period, plan_id, included_credit_micros, grace_credit_micros
			 ) SELECT ?, ?, ?, ?, ?, ?
			 WHERE ${EVENT_NOT_RECORDED}
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
          event.idempotency_key,
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
			 WHERE user_id = ? AND period = ? AND ${EVENT_NOT_RECORDED}`,
        )
        .bind(
          event.credit_micros,
          event.credit_micros,
          event.credit_micros,
          event.occurred_at,
          event.user_id,
          event.period,
          event.idempotency_key,
        ),
      database.prepare(insert.query).bind(...insert.values),
    ]);

    return (results[2]?.meta?.changes ?? 0) > 0;
  }

  async getRunChargeState(runId: string): Promise<RunChargeState | null> {
    const row = await this.runQuery<{
      spend_cap_credit_micros: number | null;
      usage_refunded_at: string | null;
      charged_credit_micros: number;
    }>(
      `SELECT spend_cap_credit_micros, usage_refunded_at,
              (SELECT COALESCE(SUM(credit_micros), 0) FROM usage_event
               WHERE run_id = conversation_run.id AND billable = 1) AS charged_credit_micros
       FROM conversation_run
       WHERE id = ?`,
      [runId],
      true,
    );

    return row
      ? {
          capCreditMicros: row.spend_cap_credit_micros,
          refunded: row.usage_refunded_at !== null,
          chargedCreditMicros: row.charged_credit_micros,
        }
      : null;
  }

  async listRunChargeGroups(runId: string): Promise<RunChargeGroup[]> {
    return this.runQuery<RunChargeGroup>(
      `SELECT user_id, workspace_id, pool_workspace_id, project_id, conversation_id, run_attempt,
              period, source, vendor, resource, unit,
              SUM(credit_micros) AS credit_micros
       FROM usage_event
       WHERE run_id = ? AND billable = 1
       GROUP BY user_id, workspace_id, pool_workspace_id, project_id, conversation_id, run_attempt,
                period, source, vendor, resource, unit
       HAVING SUM(credit_micros) > 0`,
      [runId],
    );
  }

  async applyRunChargeAdjustments(
    runId: string,
    expectedChargedCreditMicros: number,
    events: readonly UsageEventRecord[],
  ): Promise<boolean> {
    if (events.length === 0) {
      return true;
    }

    const database = this.env.DB;

    if (!database) {
      throw new AssistantError("Database not configured", ErrorType.CONFIGURATION_ERROR);
    }

    const placeholders = INSERT_COLUMNS.map(() => "?").join(", ");
    let expected = expectedChargedCreditMicros;
    const statements = events.flatMap((event) => {
      const returned = -event.credit_micros;
      const insert = this.buildInsert(event);
      const guard = [runId, expected];

      expected -= returned;

      const returnSpend = event.pool_workspace_id
        ? database
            .prepare(
              `UPDATE workspace_usage_pool
               SET overrun_credit_micros = MAX(0, overrun_credit_micros
                     - ${POOL_SPEND_RETURNED_FROM_PAST_CEILING}),
                   spent_credit_micros = MAX(0, spent_credit_micros - ?),
                   updated_at = CURRENT_TIMESTAMP
               WHERE workspace_id = ? AND period = ? AND ${RUN_CHARGE_UNCHANGED}`,
            )
            .bind(returned, returned, event.pool_workspace_id, event.period, ...guard)
        : database
            .prepare(
              `UPDATE usage_balance
               SET overrun_credit_micros = MAX(0, overrun_credit_micros
                     - CASE WHEN ${CREDITS_ENFORCED} AND overage_enabled = 0
                       THEN ${SPEND_RETURNED_FROM_PAST_CEILING} ELSE 0 END),
                   overage_credit_micros = MAX(0, overage_credit_micros
                     - CASE WHEN ${CREDITS_ENFORCED} AND overage_enabled = 1
                       THEN ${SPEND_RETURNED_FROM_PAST_CEILING} ELSE 0 END),
                   spent_credit_micros = MAX(0, spent_credit_micros - ?),
                   updated_at = CURRENT_TIMESTAMP
               WHERE user_id = ? AND period = ? AND ${RUN_CHARGE_UNCHANGED}`,
            )
            .bind(returned, returned, returned, event.user_id, event.period, ...guard);

      return [
        returnSpend,
        database
          .prepare(
            `INSERT INTO usage_event (${INSERT_COLUMNS.join(", ")})
             SELECT ${placeholders}
             WHERE ${RUN_CHARGE_UNCHANGED}
             ON CONFLICT (idempotency_key) DO NOTHING`,
          )
          .bind(...insert.values, ...guard),
      ];
    });
    const results = await this.executeBatch(statements);

    return (results.at(-1)?.meta?.changes ?? 0) > 0;
  }

  async insertEventAndApplyPool(event: UsageEventRecord, workspaceId: string): Promise<boolean> {
    const database = this.env.DB;

    if (!database) {
      throw new AssistantError("Database not configured", ErrorType.CONFIGURATION_ERROR);
    }

    const insert = this.buildInsert({ ...event, pool_workspace_id: workspaceId });
    const results = await this.executeBatch([
      database
        .prepare(
          `INSERT INTO workspace_usage_pool (workspace_id, period)
			 SELECT ?, ?
			 WHERE ${EVENT_NOT_RECORDED}
			 ON CONFLICT (workspace_id, period) DO NOTHING`,
        )
        .bind(workspaceId, event.period, event.idempotency_key),
      database
        .prepare(
          `UPDATE workspace_usage_pool
			 SET spent_credit_micros = spent_credit_micros + ?,
			     overrun_credit_micros = overrun_credit_micros + ${POOL_SPEND_PAST_CEILING},
			     last_event_at = MAX(COALESCE(last_event_at, ''), ?),
			     updated_at = CURRENT_TIMESTAMP
			 WHERE workspace_id = ? AND period = ? AND ${EVENT_NOT_RECORDED}`,
        )
        .bind(
          event.credit_micros,
          event.credit_micros,
          event.occurred_at,
          workspaceId,
          event.period,
          event.idempotency_key,
        ),
      database.prepare(insert.query).bind(...insert.values),
    ]);

    return (results[2]?.meta?.changes ?? 0) > 0;
  }

  async listUserEvents(params: ListUsageEventsParams): Promise<UsageEventRecordRow[]> {
    const values: unknown[] = [params.userId, params.period];
    let sourceClause = "";
    let cursorClause = "";

    if (params.source) {
      sourceClause = " AND source = ?";
      values.push(params.source);
    }

    if (params.after) {
      cursorClause =
        " AND (occurred_at, id) < (SELECT occurred_at, id FROM usage_event WHERE id = ? AND user_id = ?)";
      values.push(params.after, params.userId);
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
         AND resource IN (${placeholders}) AND occurred_at >= ? AND credit_micros >= 0`,
      [input.workspaceId, input.vendor, ...input.resources, input.since],
      true,
    );

    return row ?? { requests: 0, input_tokens: 0, output_tokens: 0, cost_micros: 0 };
  }

  async lastModelUseAt(input: {
    workspaceId: string;
    vendor: string;
    resource: string;
  }): Promise<string | null> {
    const row = await this.runQuery<{ occurred_at: string | null }>(
      `SELECT MAX(occurred_at) AS occurred_at
       FROM usage_event
       WHERE workspace_id = ? AND source = 'model' AND vendor = ? AND resource = ?`,
      [input.workspaceId, input.vendor, input.resource],
      true,
    );

    return row?.occurred_at ?? null;
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

  async summariseRunSpend(params: {
    period: string;
    teammateContextId?: string;
    recipeInstallationId?: string;
  }): Promise<RunSpendSummaryRow> {
    const conditions: string[] = [];
    const bindings: unknown[] = [params.period];

    if (params.teammateContextId) {
      conditions.push("r.teammate_context_id = ?");
      bindings.push(params.teammateContextId);
    }

    if (params.recipeInstallationId) {
      conditions.push(`(r.recipe_installation_id = ? OR EXISTS (
        SELECT 1 FROM activity_record a
        WHERE a.id = ue.activity_id AND a.created_by_user_id = ue.user_id
          AND a.project_id IS NULL
          AND a.kind = 'recipe.execution' AND a.group_id = ?
      ))`);
      bindings.push(params.recipeInstallationId, params.recipeInstallationId);
    }

    if (conditions.length === 0) {
      return { credit_micros: 0, cost_micros: 0, run_count: 0 };
    }

    const rows = await this.runQuery<RunSpendSummaryRow>(
      `SELECT COALESCE(SUM(ue.credit_micros), 0) AS credit_micros,
              COALESCE(SUM(ue.cost_micros), 0) AS cost_micros,
              COUNT(DISTINCT ue.run_id) AS run_count
       FROM usage_event ue
       LEFT JOIN conversation_run r ON r.id = ue.run_id
       WHERE ue.period = ? AND (${conditions.join(" OR ")})`,
      bindings,
    );

    return rows[0] ?? { credit_micros: 0, cost_micros: 0, run_count: 0 };
  }

  async summariseWorkspaceSpend(params: {
    workspaceId: string;
    period: string;
    groupBy: "teammate" | "project" | "task";
  }): Promise<(RunSpendSummaryRow & { group_id: string })[]> {
    const groupColumn =
      params.groupBy === "teammate"
        ? "tc.teammate_id"
        : params.groupBy === "project"
          ? "r.project_id"
          : "r.project_task_id";

    return this.runQuery<RunSpendSummaryRow & { group_id: string }>(
      `SELECT ${groupColumn} AS group_id,
              COALESCE(SUM(ue.credit_micros), 0) AS credit_micros,
              COALESCE(SUM(ue.cost_micros), 0) AS cost_micros,
              COUNT(DISTINCT ue.run_id) AS run_count
       FROM usage_event ue
       JOIN conversation_run r ON r.id = ue.run_id
       JOIN project p ON p.id = r.project_id
       LEFT JOIN teammate_context tc ON tc.id = r.teammate_context_id
       WHERE ue.period = ? AND p.workspace_id = ? AND ${groupColumn} IS NOT NULL
       GROUP BY ${groupColumn}
       ORDER BY credit_micros DESC
       LIMIT 200`,
      [params.period, params.workspaceId],
    );
  }

  async summariseChatRuns(runIds: readonly string[]): Promise<ChatRunUsageEventSummaryRow[]> {
    if (runIds.length === 0) {
      return [];
    }

    const placeholders = runIds.map(() => "?").join(", ");

    return this.runQuery<ChatRunUsageEventSummaryRow>(
      `SELECT run_id, run_attempt, source,
              COALESCE(SUM(CASE WHEN credit_micros < 0 THEN 0 ELSE 1 END), 0) AS event_count,
              COALESCE(SUM(cost_micros), 0) AS cost_micros,
              COALESCE(SUM(credit_micros), 0) AS credit_micros,
              COALESCE(SUM(CASE WHEN estimated = 1 THEN 1 ELSE 0 END), 0)
                AS estimated_price_event_count,
              COALESCE(SUM(CASE WHEN unit LIKE '%input_tokens'
                THEN quantity ELSE 0 END), 0) AS input_tokens,
              COALESCE(SUM(CASE WHEN reason = 'platform_failure_refund'
                THEN -credit_micros ELSE 0 END), 0) AS refunded_credit_micros,
              COALESCE(SUM(CASE WHEN reason = 'run_cap_absorbed'
                THEN -credit_micros ELSE 0 END), 0) AS absorbed_credit_micros
       FROM usage_event
       WHERE run_id IN (${placeholders})
       GROUP BY run_id, run_attempt, source
       ORDER BY run_id ASC, run_attempt ASC, source ASC`,
      [...runIds],
    );
  }
}
