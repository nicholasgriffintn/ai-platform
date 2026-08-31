import { AssistantError, ErrorType } from "~/utils/errors";

import { BaseRepository } from "./BaseRepository";

export const ADDITIVE_BALANCE_COLUMNS = [
  "included_credit_micros",
  "grace_credit_micros",
  "spent_credit_micros",
  "reserved_credit_micros",
  "overrun_credit_micros",
  "overage_credit_micros",
] as const;

export type AdditiveBalanceColumn = (typeof ADDITIVE_BALANCE_COLUMNS)[number];

export type BalanceDeltas = Partial<Record<AdditiveBalanceColumn, number>>;

export interface UsageBalanceRow {
  id: string;
  user_id: number;
  period: string;
  plan_id: string | null;
  included_credit_micros: number;
  grace_credit_micros: number;
  spent_credit_micros: number;
  reserved_credit_micros: number;
  overrun_credit_micros: number;
  overage_credit_micros: number;
  overage_enabled: number;
  last_event_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface EnsureBalanceParams {
  userId: number;
  period: string;
  planId?: string | null;
  includedCreditMicros?: number;
  graceCreditMicros?: number;
}

export interface ApplyBalanceDeltasParams extends EnsureBalanceParams {
  deltas: BalanceDeltas;
  lastEventAt?: string;
}

export function usageBalanceId(userId: number, period: string): string {
  return `${userId}:${period}`;
}

export class UsageBalanceRepository extends BaseRepository {
  async ensureBalance(params: EnsureBalanceParams): Promise<void> {
    await this.executeRun(
      `INSERT INTO usage_balance (
				id, user_id, period, plan_id, included_credit_micros, grace_credit_micros
			 ) VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT (user_id, period) DO NOTHING`,
      [
        usageBalanceId(params.userId, params.period),
        params.userId,
        params.period,
        params.planId ?? null,
        params.includedCreditMicros ?? 0,
        params.graceCreditMicros ?? 0,
      ],
    );
  }

  async applyDeltas(params: ApplyBalanceDeltasParams): Promise<void> {
    const assignments: string[] = [];
    const values: unknown[] = [];

    for (const column of ADDITIVE_BALANCE_COLUMNS) {
      const delta = params.deltas[column];

      if (delta === undefined || delta === 0) {
        continue;
      }

      if (!Number.isFinite(delta)) {
        throw new AssistantError(
          `Non-finite usage balance delta for ${column}`,
          ErrorType.PARAMS_ERROR,
        );
      }

      assignments.push(`${column} = ${column} + ?`);
      values.push(Math.round(delta));
    }

    if (params.lastEventAt) {
      assignments.push("last_event_at = MAX(COALESCE(last_event_at, ''), ?)");
      values.push(params.lastEventAt);
    }

    if (assignments.length === 0) {
      return;
    }

    await this.ensureBalance(params);

    values.push(params.userId, params.period);

    await this.executeRun(
      `UPDATE usage_balance
			 SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP
			 WHERE user_id = ? AND period = ?`,
      values,
    );
  }

  async getBalance(userId: number, period: string): Promise<UsageBalanceRow | null> {
    return this.runQuery<UsageBalanceRow>(
      "SELECT * FROM usage_balance WHERE user_id = ? AND period = ?",
      [userId, period],
      true,
    );
  }

  async setOverageEnabled(userId: number, period: string, enabled: boolean): Promise<void> {
    await this.executeRun(
      `UPDATE usage_balance
			 SET overage_enabled = ?, updated_at = CURRENT_TIMESTAMP
			 WHERE user_id = ? AND period = ?`,
      [enabled ? 1 : 0, userId, period],
    );
  }
}
