import type { UsageReservationKind, UsageReservationStatus } from "@ngriffin_uk/polychat-schemas";

import { recordD1ResultMeta } from "~/lib/usage/requestMeter";
import { AssistantError, ErrorType } from "~/utils/errors";

import { BaseRepository } from "./BaseRepository";
import { usageBalanceId } from "./UsageBalanceRepository";

export interface UsageReservationRow {
  id: string;
  user_id: number;
  period: string;
  kind: UsageReservationKind;
  ref_id: string;
  credit_micros: number;
  status: UsageReservationStatus;
  expires_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface CreateUsageReservationParams {
  id: string;
  userId: number;
  period: string;
  kind: UsageReservationKind;
  refId: string;
  creditMicros: number;
  expiresAt?: string | null;
}

export class UsageReservationRepository extends BaseRepository {
  async createUserReservationWithBalance(
    params: CreateUsageReservationParams & {
      planId: string | null;
      includedCreditMicros: number;
      graceCreditMicros: number;
    },
  ): Promise<boolean> {
    const statements = [
      this.env.DB.prepare(
        `INSERT INTO usage_balance (
           id, user_id, period, plan_id, included_credit_micros, grace_credit_micros
         ) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, period) DO NOTHING`,
      ).bind(
        usageBalanceId(params.userId, params.period),
        params.userId,
        params.period,
        params.planId,
        params.includedCreditMicros,
        params.graceCreditMicros,
      ),
      this.env.DB.prepare(
        `INSERT INTO usage_reservation (
           id, user_id, period, kind, ref_id, credit_micros, status, expires_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'held', ?)
         ON CONFLICT (kind, ref_id) DO NOTHING`,
      ).bind(
        params.id,
        params.userId,
        params.period,
        params.kind,
        params.refId,
        params.creditMicros,
        params.expiresAt ?? null,
      ),
      this.env.DB.prepare(
        `UPDATE usage_balance
         SET reserved_credit_micros = reserved_credit_micros + ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND period = ?
           AND EXISTS (
             SELECT 1 FROM usage_reservation
             WHERE id = ? AND status = 'held'
           )`,
      ).bind(params.creditMicros, params.userId, params.period, params.id),
    ];
    const results = await this.env.DB.batch(statements);

    for (const result of results) {
      recordD1ResultMeta(result.meta);

      if (!result.success) {
        throw new AssistantError(
          "Could not persist the durable usage reservation",
          ErrorType.DATABASE_ERROR,
        );
      }
    }

    return (results[1]?.meta?.changes ?? 0) > 0;
  }

  async createReservation(params: CreateUsageReservationParams): Promise<boolean> {
    const result = await this.executeRun(
      `INSERT INTO usage_reservation (
				id, user_id, period, kind, ref_id, credit_micros, status, expires_at
			 ) VALUES (?, ?, ?, ?, ?, ?, 'held', ?)
			 ON CONFLICT (kind, ref_id) DO NOTHING`,
      [
        params.id,
        params.userId,
        params.period,
        params.kind,
        params.refId,
        params.creditMicros,
        params.expiresAt ?? null,
      ],
    );

    return (result.meta?.changes ?? 0) > 0;
  }

  async finishUserReservationWithBalance(
    kind: UsageReservationKind,
    refId: string,
    outcome: Extract<UsageReservationStatus, "settled" | "released">,
  ): Promise<UsageReservationRow | null> {
    const statements = [
      this.env.DB.prepare(
        `UPDATE usage_reservation
         SET status = 'releasing', updated_at = CURRENT_TIMESTAMP
         WHERE kind = ? AND ref_id = ? AND status = 'held'`,
      ).bind(kind, refId),
      this.env.DB.prepare(
        `UPDATE usage_balance
         SET reserved_credit_micros = MAX(
               0,
               reserved_credit_micros - COALESCE((
                 SELECT credit_micros FROM usage_reservation
                 WHERE kind = ? AND ref_id = ? AND status = 'releasing'
               ), 0)
             ),
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = (
                 SELECT user_id FROM usage_reservation
                 WHERE kind = ? AND ref_id = ? AND status = 'releasing'
               )
           AND period = (
                 SELECT period FROM usage_reservation
                 WHERE kind = ? AND ref_id = ? AND status = 'releasing'
               )`,
      ).bind(kind, refId, kind, refId, kind, refId),
      this.env.DB.prepare(
        `UPDATE usage_reservation
         SET status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE kind = ? AND ref_id = ? AND status = 'releasing'
         RETURNING *`,
      ).bind(outcome, kind, refId),
    ];
    const results = await this.env.DB.batch(statements);

    for (const result of results) {
      recordD1ResultMeta(result.meta);

      if (!result.success) {
        throw new AssistantError(
          "Could not finish the durable usage reservation",
          ErrorType.DATABASE_ERROR,
        );
      }
    }

    return (results[2]?.results[0] as UsageReservationRow | undefined) ?? null;
  }

  async getReservation(
    kind: UsageReservationKind,
    refId: string,
  ): Promise<UsageReservationRow | null> {
    return this.runQuery<UsageReservationRow>(
      "SELECT * FROM usage_reservation WHERE kind = ? AND ref_id = ?",
      [kind, refId],
      true,
    );
  }

  async listReservations(kind: UsageReservationKind, refIds: readonly string[]) {
    if (refIds.length === 0) {
      return [];
    }

    const placeholders = refIds.map(() => "?").join(", ");

    return this.runQuery<UsageReservationRow>(
      `SELECT * FROM usage_reservation
       WHERE kind = ? AND ref_id IN (${placeholders})`,
      [kind, ...refIds],
    );
  }

  async listExpiredHeldReservations(
    kind: UsageReservationKind,
    before: string,
    limit: number,
  ): Promise<UsageReservationRow[]> {
    return this.runQuery<UsageReservationRow>(
      `SELECT * FROM usage_reservation
       WHERE kind = ? AND status = 'held' AND expires_at IS NOT NULL AND expires_at <= ?
       ORDER BY expires_at ASC
       LIMIT ?`,
      [kind, before, limit],
    );
  }

  async transitionHeldReservation(
    kind: UsageReservationKind,
    refId: string,
    status: Extract<UsageReservationStatus, "settled" | "released">,
  ): Promise<boolean> {
    const result = await this.executeRun(
      `UPDATE usage_reservation
			 SET status = ?, updated_at = CURRENT_TIMESTAMP
			 WHERE kind = ? AND ref_id = ? AND status = 'held'`,
      [status, kind, refId],
    );

    return (result.meta?.changes ?? 0) > 0;
  }
}
