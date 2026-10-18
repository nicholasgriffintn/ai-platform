import type { SkillUseActivation } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";

export interface SkillUseInput {
  skillId: string;
  revisionId: string;
  userId: number;
  runId: string | null;
  conversationId: string;
  activation: SkillUseActivation;
}

export interface SkillUseSummaryRow {
  uses_total: number;
  uses_in_window: number;
  last_used_at: string | null;
}

export interface SkillUseRunRow {
  run_id: string;
  conversation_id: string;
}

export class SkillUseRepository extends BaseRepository {
  async record(uses: readonly SkillUseInput[]): Promise<void> {
    if (uses.length === 0) {
      return;
    }

    await this.executeBatch(
      uses.map((use) =>
        this.env.DB.prepare(
          `INSERT INTO skill_use (id, skill_id, revision_id, user_id, run_id, conversation_id, activation)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          generateId(),
          use.skillId,
          use.revisionId,
          use.userId,
          use.runId,
          use.conversationId,
          use.activation,
        ),
      ),
    );
  }

  async summarise(skillId: string, windowStart: string): Promise<SkillUseSummaryRow> {
    const row = await this.runQuery<SkillUseSummaryRow>(
      `SELECT COUNT(*) AS uses_total,
              COALESCE(SUM(CASE WHEN used_at >= ? THEN 1 ELSE 0 END), 0) AS uses_in_window,
              MAX(used_at) AS last_used_at
       FROM skill_use WHERE skill_id = ?`,
      [windowStart, skillId],
      true,
    );

    return row ?? { uses_total: 0, uses_in_window: 0, last_used_at: null };
  }

  async listRecentRuns(skillId: string, limit: number): Promise<SkillUseRunRow[]> {
    return this.runQuery<SkillUseRunRow>(
      `SELECT run_id, conversation_id FROM skill_use
       WHERE skill_id = ? AND run_id IS NOT NULL
       GROUP BY run_id, conversation_id
       ORDER BY MAX(used_at) DESC
       LIMIT ?`,
      [skillId, limit],
    );
  }
}
