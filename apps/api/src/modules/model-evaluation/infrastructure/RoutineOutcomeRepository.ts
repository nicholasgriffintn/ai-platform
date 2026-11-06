import type { RoutineKind, RunVerificationStatus } from "@ngriffin_uk/polychat-schemas";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";

export type RoutineOutcomeStatus = RunVerificationStatus | "pending";

export interface RoutineOutcomeSummaryRow {
  routine_id: string;
  routine_kind: RoutineKind;
  runs: number;
  verified: number;
  unverified: number;
  failed: number;
  false_completions: number;
  last_status: RunVerificationStatus;
  last_run_at: string;
}

export class RoutineOutcomeRepository extends BaseRepository {
  public async record(input: {
    id: string;
    userId: number;
    projectId: string | null;
    kind: RoutineKind;
    routineId: string;
    runId: string | null;
    status: RoutineOutcomeStatus;
    occurredAt: string;
  }): Promise<void> {
    await this.executeRun(
      `INSERT INTO routine_outcome (
         id, user_id, project_id, routine_kind, routine_id, run_id, status, occurred_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         run_id = excluded.run_id,
         status = excluded.status,
         occurred_at = excluded.occurred_at`,
      [
        input.id,
        input.userId,
        input.projectId,
        input.kind,
        input.routineId,
        input.runId,
        input.status,
        input.occurredAt,
      ],
    );
  }

  public async settle(input: {
    id: string;
    runId: string | null;
    status: RunVerificationStatus;
    occurredAt: string;
  }): Promise<void> {
    await this.executeRun(
      "UPDATE routine_outcome SET run_id = ?, status = ?, occurred_at = ? WHERE id = ?",
      [input.runId, input.status, input.occurredAt, input.id],
    );
  }

  public async markFalseCompletion(id: string): Promise<void> {
    await this.executeRun(
      "UPDATE routine_outcome SET false_completion = 1 WHERE id = ? AND status = 'verified'",
      [id],
    );
  }

  public async summarise(userId: number, since: string): Promise<RoutineOutcomeSummaryRow[]> {
    return this.runQuery<RoutineOutcomeSummaryRow>(
      `SELECT routine_id,
              routine_kind,
              COUNT(*) AS runs,
              SUM(status = 'verified') AS verified,
              SUM(status = 'unverified') AS unverified,
              SUM(status = 'failed') AS failed,
              SUM(false_completion) AS false_completions,
              status AS last_status,
              MAX(occurred_at) AS last_run_at
       FROM routine_outcome
       WHERE user_id = ? AND occurred_at >= ? AND status != 'pending'
       GROUP BY routine_id, routine_kind
       ORDER BY last_run_at DESC`,
      [userId, since],
    );
  }
}
