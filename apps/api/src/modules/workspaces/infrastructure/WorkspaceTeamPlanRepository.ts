import { BaseRepository } from "~/infrastructure/database/BaseRepository";

export interface WorkspaceTeamPlanRow {
  workspace_id: string;
  seat_limit: number;
  included_credit_micros: number;
  grace_credit_micros: number;
  provisioned_by: number | null;
  created_at: string;
  updated_at: string | null;
}

export class WorkspaceTeamPlanRepository extends BaseRepository {
  async getPlan(workspaceId: string): Promise<WorkspaceTeamPlanRow | null> {
    return this.runQuery<WorkspaceTeamPlanRow>(
      "SELECT * FROM workspace_team_plan WHERE workspace_id = ?",
      [workspaceId],
      true,
    );
  }

  async savePlan(params: {
    workspaceId: string;
    seatLimit: number;
    includedCreditMicros: number;
    graceCreditMicros: number;
    provisionedBy: number;
  }): Promise<void> {
    await this.executeRun(
      `INSERT INTO workspace_team_plan (
         workspace_id, seat_limit, included_credit_micros, grace_credit_micros, provisioned_by
       ) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (workspace_id) DO UPDATE SET
         seat_limit = excluded.seat_limit,
         included_credit_micros = excluded.included_credit_micros,
         grace_credit_micros = excluded.grace_credit_micros,
         provisioned_by = excluded.provisioned_by,
         updated_at = CURRENT_TIMESTAMP`,
      [
        params.workspaceId,
        params.seatLimit,
        params.includedCreditMicros,
        params.graceCreditMicros,
        params.provisionedBy,
      ],
    );
  }

  async deletePlan(workspaceId: string): Promise<boolean> {
    const result = await this.executeRun("DELETE FROM workspace_team_plan WHERE workspace_id = ?", [
      workspaceId,
    ]);

    return (result.meta?.changes ?? 0) > 0;
  }

  async countMembers(workspaceId: string): Promise<number> {
    const row = await this.runQuery<{ count: number }>(
      "SELECT COUNT(*) AS count FROM resource_grant WHERE kind = 'membership' AND workspace_id = ?",
      [workspaceId],
      true,
    );

    return row?.count ?? 0;
  }

  async countOccupiedSeats(
    workspaceId: string,
    options: { now: string; exceptInvitedEmail?: string },
  ): Promise<number> {
    const row = await this.runQuery<{ count: number }>(
      `SELECT COUNT(*) AS count FROM resource_grant
       WHERE workspace_id = ?
         AND (
           kind = 'membership'
           OR (kind = 'invitation' AND status = 'pending' AND expires_at > ? AND email != ?)
         )`,
      [workspaceId, options.now, options.exceptInvitedEmail ?? ""],
      true,
    );

    return row?.count ?? 0;
  }
}
