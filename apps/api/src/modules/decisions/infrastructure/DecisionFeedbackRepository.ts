import type { DecisionCorrection } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";

export interface RecordDecisionFeedbackInput {
  policyKey: string;
  policyVersion: string;
  userId: number;
  recommended: string;
  corrected: string;
  summary: string;
}

interface DecisionCorrectionRow {
  recommended_outcome: string;
  corrected_outcome: string;
  summary: string;
}

export class DecisionFeedbackRepository extends BaseRepository {
  public async record(input: RecordDecisionFeedbackInput): Promise<void> {
    await this.executeRun(
      `INSERT INTO decision_feedback
        (id, policy_key, policy_version, user_id, recommended_outcome, corrected_outcome, summary)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        input.policyKey,
        input.policyVersion,
        input.userId,
        input.recommended,
        input.corrected,
        input.summary,
      ],
    );
  }

  public async recentCorrections(input: {
    policyKey: string;
    policyVersion: string;
    userId: number;
    limit: number;
  }): Promise<DecisionCorrection[]> {
    const rows = await this.runQuery<DecisionCorrectionRow>(
      `SELECT recommended_outcome, corrected_outcome, summary
         FROM decision_feedback
        WHERE policy_key = ? AND policy_version = ? AND user_id = ?
        ORDER BY created_at DESC
        LIMIT ?`,
      [input.policyKey, input.policyVersion, input.userId, input.limit],
    );

    return rows.map((row) => ({
      recommended: row.recommended_outcome,
      corrected: row.corrected_outcome,
      summary: row.summary,
    }));
  }
}
