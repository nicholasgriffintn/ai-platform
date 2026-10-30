import type { Correction, CorrectionPlacement } from "@ngriffin_uk/polychat-schemas";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { CorrectionRow } from "~/infrastructure/database/schema";

function formatCorrection(row: CorrectionRow): Correction {
  return {
    id: row.id,
    pattern: row.pattern,
    quote: row.quote,
    placement: row.placement,
    placementRef: row.placement_ref,
    recurrences: row.recurrences,
    status: row.status,
    createdAt: row.created_at,
    lastRecurredAt: row.last_recurred_at,
  };
}

export class CorrectionRepository extends BaseRepository {
  public async create(input: {
    id: string;
    userId: number;
    teammateContextId: string | null;
    conversationId: string;
    pattern: string;
    quote: string;
    placement: CorrectionPlacement;
    placementRef: string | null;
  }): Promise<void> {
    await this.executeRun(
      `INSERT INTO correction (
         id, user_id, teammate_context_id, conversation_id, pattern, quote, placement, placement_ref
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.userId,
        input.teammateContextId,
        input.conversationId,
        input.pattern,
        input.quote,
        input.placement,
        input.placementRef,
      ],
    );
  }

  public async listActive(userId: number, limit: number): Promise<Correction[]> {
    const rows = await this.runQuery<CorrectionRow>(
      `SELECT * FROM correction WHERE user_id = ? AND status = 'active'
       ORDER BY COALESCE(last_recurred_at, created_at) DESC, id DESC LIMIT ?`,
      [userId, limit],
    );

    return rows.map(formatCorrection);
  }

  public async listActiveForTeammateContext(
    userId: number,
    teammateContextId: string | null,
    limit: number,
  ): Promise<Correction[]> {
    const rows = await this.runQuery<CorrectionRow>(
      `SELECT * FROM correction WHERE user_id = ? AND status = 'active'
       AND (teammate_context_id IS NULL OR teammate_context_id = ?)
       ORDER BY recurrences DESC, COALESCE(last_recurred_at, created_at) DESC, id DESC LIMIT ?`,
      [userId, teammateContextId, limit],
    );

    return rows.map(formatCorrection);
  }

  public async listActiveByPlacementRefs(
    userId: number,
    placementRefs: readonly string[],
  ): Promise<Correction[]> {
    if (placementRefs.length === 0) {
      return [];
    }

    const rows = await this.runQuery<CorrectionRow>(
      `SELECT * FROM correction WHERE user_id = ? AND status = 'active'
       AND placement_ref IN (${placementRefs.map(() => "?").join(", ")})`,
      [userId, ...placementRefs],
    );

    return rows.map(formatCorrection);
  }

  public async recordRecurrence(params: {
    userId: number;
    id: string;
    placement: CorrectionPlacement;
    placementRef: string | null;
    recurredAt: string;
  }): Promise<void> {
    await this.executeRun(
      `UPDATE correction
       SET recurrences = recurrences + 1, last_recurred_at = ?, placement = ?, placement_ref = ?
       WHERE id = ? AND user_id = ? AND status = 'active'`,
      [params.recurredAt, params.placement, params.placementRef, params.id, params.userId],
    );
  }

  public async dismiss(userId: number, id: string): Promise<boolean> {
    const result = await this.executeRun(
      "UPDATE correction SET status = 'dismissed' WHERE id = ? AND user_id = ? AND status = 'active'",
      [id, userId],
    );

    return (result.meta?.changes ?? 0) > 0;
  }
}
