import { recordD1ResultMeta, type WorkspacePoolRecord } from "@ngriffin_uk/polychat-ai-billing";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { IEnv } from "~/types";

import type { CreateUsageReservationParams } from "./UsageReservationRepository";

const ENSURE_POOL = `INSERT INTO workspace_usage_pool (workspace_id, period)
  VALUES (?, ?)
  ON CONFLICT (workspace_id, period) DO NOTHING`;

export const POOL_CEILING = `(
  SELECT included_credit_micros + grace_credit_micros
  FROM workspace_team_plan
  WHERE workspace_team_plan.workspace_id = workspace_usage_pool.workspace_id
)`;

export class WorkspacePoolRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async getPool(workspaceId: string, period: string): Promise<WorkspacePoolRecord | null> {
    return this.runQuery<WorkspacePoolRecord>(
      `SELECT plan.included_credit_micros, plan.grace_credit_micros,
              COALESCE(pool.spent_credit_micros, 0) AS spent_credit_micros,
              COALESCE(pool.reserved_credit_micros, 0) AS reserved_credit_micros,
              COALESCE(pool.overrun_credit_micros, 0) AS overrun_credit_micros,
              pool.last_event_at
       FROM workspace_team_plan plan
       LEFT JOIN workspace_usage_pool pool
         ON pool.workspace_id = plan.workspace_id AND pool.period = ?
       WHERE plan.workspace_id = ?`,
      [period, workspaceId],
      true,
    );
  }

  async reserve(workspaceId: string, period: string, creditMicros: number): Promise<boolean> {
    const results = await this.batch([
      this.env.DB.prepare(ENSURE_POOL).bind(workspaceId, period),
      this.env.DB.prepare(
        `UPDATE workspace_usage_pool
         SET reserved_credit_micros = reserved_credit_micros + ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE workspace_id = ? AND period = ?
           AND spent_credit_micros + reserved_credit_micros + ? <= ${POOL_CEILING}`,
      ).bind(creditMicros, workspaceId, period, creditMicros),
    ]);

    return (results[1]?.meta?.changes ?? 0) > 0;
  }

  async adjustReserved(workspaceId: string, period: string, deltaCreditMicros: number) {
    if (!Number.isFinite(deltaCreditMicros) || deltaCreditMicros === 0) {
      return;
    }

    const adjust = this.env.DB.prepare(
      `UPDATE workspace_usage_pool
       SET reserved_credit_micros = MAX(0, reserved_credit_micros + ?),
           updated_at = CURRENT_TIMESTAMP
       WHERE workspace_id = ? AND period = ?`,
    ).bind(Math.round(deltaCreditMicros), workspaceId, period);

    await this.batch(
      deltaCreditMicros > 0
        ? [this.env.DB.prepare(ENSURE_POOL).bind(workspaceId, period), adjust]
        : [adjust],
    );
  }

  async createReservation(
    params: CreateUsageReservationParams & { workspaceId: string },
  ): Promise<boolean> {
    const results = await this.batch([
      this.env.DB.prepare(ENSURE_POOL).bind(params.workspaceId, params.period),
      this.env.DB.prepare(
        `INSERT INTO usage_reservation (
           id, user_id, period, kind, ref_id, credit_micros, status, expires_at, workspace_id
         ) SELECT ?, ?, ?, ?, ?, ?, 'held', ?, workspace_id
         FROM workspace_usage_pool
         WHERE workspace_id = ? AND period = ?
           AND spent_credit_micros + reserved_credit_micros + ? <= ${POOL_CEILING}
         ON CONFLICT (kind, ref_id) DO UPDATE SET
           id = excluded.id,
           period = excluded.period,
           credit_micros = excluded.credit_micros,
           status = 'held',
           expires_at = excluded.expires_at,
           workspace_id = excluded.workspace_id,
           updated_at = CURRENT_TIMESTAMP
         WHERE usage_reservation.status IN ('settled', 'released')
           AND usage_reservation.user_id = excluded.user_id`,
      ).bind(
        params.id,
        params.userId,
        params.period,
        params.kind,
        params.refId,
        params.creditMicros,
        params.expiresAt ?? null,
        params.workspaceId,
        params.period,
        params.creditMicros,
      ),
      this.env.DB.prepare(
        `UPDATE workspace_usage_pool
         SET reserved_credit_micros = reserved_credit_micros + ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE workspace_id = ? AND period = ?
           AND changes() > 0
           AND EXISTS (
             SELECT 1 FROM usage_reservation
             WHERE id = ? AND status = 'held'
           )`,
      ).bind(params.creditMicros, params.workspaceId, params.period, params.id),
    ]);

    return (results[1]?.meta?.changes ?? 0) > 0;
  }

  private async batch(statements: D1PreparedStatement[]) {
    const results = await this.env.DB.batch(statements);

    for (const result of results) {
      recordD1ResultMeta(result.meta);

      if (!result.success) {
        throw new AssistantError("Could not update the usage pool", ErrorType.DATABASE_ERROR);
      }
    }

    return results;
  }
}
