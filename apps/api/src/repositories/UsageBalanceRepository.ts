import { BaseRepository } from "./BaseRepository";

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

export class UsageBalanceRepository extends BaseRepository {
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
