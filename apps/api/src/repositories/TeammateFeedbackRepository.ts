import type { TeammateFeedbackRow } from "~/lib/database/schema";
import { generateId } from "~/utils/id";

import { BaseRepository } from "./BaseRepository";

export interface TeammateScorecard {
  teammateId: string;
  good: number;
  bad: number;
}

export class TeammateFeedbackRepository extends BaseRepository {
  public async record(input: {
    teammateId: string;
    userId: number;
    conversationId: string | null;
    verdict: "good" | "bad";
    note?: string | null;
  }): Promise<void> {
    await this.executeRun(
      `INSERT INTO teammate_feedback (id, teammate_id, user_id, conversation_id, verdict, note)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, teammate_id, conversation_id)
       DO UPDATE SET verdict = excluded.verdict, note = excluded.note`,
      [
        generateId(),
        input.teammateId,
        input.userId,
        input.conversationId,
        input.verdict,
        input.note ?? null,
      ],
    );
  }

  public async scorecardsFor(teammateIds: string[]): Promise<Map<string, TeammateScorecard>> {
    const unique = [...new Set(teammateIds)];

    if (unique.length === 0) {
      return new Map();
    }

    const rows = await this.runQuery<{ teammate_id: string; verdict: string; total: number }>(
      `SELECT teammate_id, verdict, COUNT(*) AS total
       FROM teammate_feedback
       WHERE teammate_id IN (${unique.map(() => "?").join(", ")})
       GROUP BY teammate_id, verdict`,
      unique,
    );
    const scorecards = new Map<string, TeammateScorecard>();

    for (const row of rows) {
      const existing = scorecards.get(row.teammate_id) ?? {
        teammateId: row.teammate_id,
        good: 0,
        bad: 0,
      };

      if (row.verdict === "good") {
        existing.good += row.total;
      } else {
        existing.bad += row.total;
      }

      scorecards.set(row.teammate_id, existing);
    }

    return scorecards;
  }

  public async listForTeammate(teammateId: string): Promise<TeammateFeedbackRow[]> {
    return this.runQuery<TeammateFeedbackRow>(
      "SELECT * FROM teammate_feedback WHERE teammate_id = ? ORDER BY created_at DESC LIMIT 50",
      [teammateId],
    );
  }
}
