import type { UsageReservationKind, UsageReservationStatus } from "@ngriffin_uk/polychat-schemas";

import { BaseRepository } from "./BaseRepository";

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
