import type {
  EmploymentPauseReason,
  EmploymentStatus,
  HireProposal,
  WorkWakeRecord,
} from "@ngriffin_uk/polychat-schemas";
import { parseJsonColumn } from "@ngriffin_uk/polychat-utility-server/json";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { WorkspaceTeammateRow } from "~/infrastructure/database/schema";
import { publishWorkspaceEvent } from "~/modules/sync/application/conversation-events";

export interface WorkspaceTeammateRecord {
  workspaceId: string;
  teammateId: string;
  title: string;
  reportsToTeammateId: string | null;
  status: EmploymentStatus;
  pausedReason: EmploymentPauseReason | null;
  responsibleUserId: number;
  heartbeatMinutes: number | null;
  lastHeartbeatAt: string | null;
  lastWake: WorkWakeRecord | null;
  monthlyCreditCapMicros: number | null;
  budgetWarnedPeriod: string | null;
  budgetAlertAt: string | null;
  projectIds: string[];
  proposal: HireProposal | null;
  createdAt: string;
}

const INBOX_FIELDS = [
  "title",
  "reportsToTeammateId",
  "status",
  "pausedReason",
  "budgetWarnedPeriod",
  "budgetAlertAt",
  "proposal",
] as const;

function formatRecord(row: WorkspaceTeammateRow): WorkspaceTeammateRecord {
  return {
    workspaceId: row.workspace_id,
    teammateId: row.teammate_id,
    title: row.title,
    reportsToTeammateId: row.reports_to_teammate_id,
    status: row.status,
    pausedReason: row.paused_reason,
    responsibleUserId: row.responsible_user_id,
    heartbeatMinutes: row.heartbeat_minutes,
    lastHeartbeatAt: row.last_heartbeat_at,
    lastWake: parseJsonColumn<WorkWakeRecord | null>(row.last_wake, null),
    monthlyCreditCapMicros: row.monthly_credit_cap_micros,
    budgetWarnedPeriod: row.budget_warned_period,
    budgetAlertAt: row.budget_alert_at,
    projectIds: parseJsonColumn<string[]>(row.project_ids, []),
    proposal: parseJsonColumn<HireProposal | null>(row.proposal, null),
    createdAt: row.created_at,
  };
}

interface CreateWorkspaceTeammateParams {
  workspaceId: string;
  teammateId: string;
  title: string;
  reportsToTeammateId: string | null;
  status: EmploymentStatus;
  responsibleUserId: number;
  heartbeatMinutes: number | null;
  monthlyCreditCapMicros: number | null;
  projectIds: string[];
  proposal: HireProposal | null;
}

export class WorkspaceTeammateRepository extends BaseRepository {
  async listForWorkspace(workspaceId: string): Promise<WorkspaceTeammateRecord[]> {
    const rows = await this.runQuery<WorkspaceTeammateRow>(
      "SELECT * FROM workspace_teammate WHERE workspace_id = ? ORDER BY created_at ASC",
      [workspaceId],
    );

    return rows.map(formatRecord);
  }

  async listForWorkspaces(workspaceIds: readonly string[]): Promise<WorkspaceTeammateRecord[]> {
    if (workspaceIds.length === 0) {
      return [];
    }

    const rows = await this.runQuery<WorkspaceTeammateRow>(
      `SELECT * FROM workspace_teammate WHERE workspace_id IN (${workspaceIds
        .map(() => "?")
        .join(", ")})`,
      [...workspaceIds],
    );

    return rows.map(formatRecord);
  }

  async get(workspaceId: string, teammateId: string): Promise<WorkspaceTeammateRecord | null> {
    const row = await this.runQuery<WorkspaceTeammateRow>(
      "SELECT * FROM workspace_teammate WHERE workspace_id = ? AND teammate_id = ?",
      [workspaceId, teammateId],
      true,
    );

    return row ? formatRecord(row) : null;
  }

  async listAwake(): Promise<WorkspaceTeammateRecord[]> {
    const rows = await this.runQuery<WorkspaceTeammateRow>(
      "SELECT * FROM workspace_teammate WHERE status IN ('active', 'paused')",
      [],
    );

    return rows.map(formatRecord);
  }

  async create(params: CreateWorkspaceTeammateParams): Promise<WorkspaceTeammateRecord> {
    const row = await this.runQuery<WorkspaceTeammateRow>(
      `INSERT INTO workspace_teammate (
         workspace_id, teammate_id, title, reports_to_teammate_id, status, responsible_user_id,
         heartbeat_minutes, monthly_credit_cap_micros, project_ids, proposal
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(workspace_id, teammate_id) DO UPDATE SET
         title = excluded.title,
         reports_to_teammate_id = excluded.reports_to_teammate_id,
         status = excluded.status,
         heartbeat_minutes = excluded.heartbeat_minutes,
         monthly_credit_cap_micros = excluded.monthly_credit_cap_micros,
         project_ids = excluded.project_ids,
         proposal = excluded.proposal,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        params.workspaceId,
        params.teammateId,
        params.title,
        params.reportsToTeammateId,
        params.status,
        params.responsibleUserId,
        params.heartbeatMinutes,
        params.monthlyCreditCapMicros,
        JSON.stringify(params.projectIds),
        params.proposal ? JSON.stringify(params.proposal) : null,
      ],
      true,
    );

    if (!row) {
      throw new Error("Failed to record the teammate's place in the workspace");
    }

    await this.publishAttentionChanged(params.workspaceId);

    return formatRecord(row);
  }

  async update(
    workspaceId: string,
    teammateId: string,
    updates: Partial<{
      title: string;
      reportsToTeammateId: string | null;
      status: EmploymentStatus;
      pausedReason: EmploymentPauseReason | null;
      heartbeatMinutes: number | null;
      lastHeartbeatAt: string | null;
      lastWake: WorkWakeRecord | null;
      monthlyCreditCapMicros: number | null;
      budgetWarnedPeriod: string | null;
      budgetAlertAt: string | null;
      projectIds: string[];
      proposal: HireProposal | null;
    }>,
  ): Promise<WorkspaceTeammateRecord | null> {
    const columns: Record<string, unknown> = {};
    const map: Record<string, string> = {
      title: "title",
      reportsToTeammateId: "reports_to_teammate_id",
      status: "status",
      pausedReason: "paused_reason",
      heartbeatMinutes: "heartbeat_minutes",
      lastHeartbeatAt: "last_heartbeat_at",
      lastWake: "last_wake",
      monthlyCreditCapMicros: "monthly_credit_cap_micros",
      budgetWarnedPeriod: "budget_warned_period",
      budgetAlertAt: "budget_alert_at",
      projectIds: "project_ids",
      proposal: "proposal",
    };

    for (const [key, column] of Object.entries(map)) {
      const value = updates[key as keyof typeof updates];

      if (value !== undefined) {
        columns[column] =
          value !== null && typeof value === "object" ? JSON.stringify(value) : value;
      }
    }

    const assignments = Object.keys(columns);

    if (assignments.length === 0) {
      return this.get(workspaceId, teammateId);
    }

    const row = await this.runQuery<WorkspaceTeammateRow>(
      `UPDATE workspace_teammate
       SET ${assignments.map((column) => `${column} = ?`).join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE workspace_id = ? AND teammate_id = ?
       RETURNING *`,
      [...assignments.map((column) => columns[column]), workspaceId, teammateId],
      true,
    );

    if (row && INBOX_FIELDS.some((field) => updates[field] !== undefined)) {
      await this.publishAttentionChanged(workspaceId);
    }

    return row ? formatRecord(row) : null;
  }

  async listRecentRuns(
    workspaceId: string,
    since: string,
  ): Promise<
    {
      id: string;
      teammate_id: string;
      status: string;
      trigger: string;
      created_at: string;
      project_id: string | null;
      project_task_id: string | null;
    }[]
  > {
    return this.runQuery(
      `SELECT r.id, tc.teammate_id, r.status, r.trigger, r.created_at, r.project_id, r.project_task_id
       FROM conversation_run r
       JOIN teammate_context tc ON tc.id = r.teammate_context_id
       JOIN project p ON p.id = r.project_id
       WHERE p.workspace_id = ? AND r.created_at >= ?
       ORDER BY r.created_at ASC
       LIMIT 1000`,
      [workspaceId, since],
    );
  }

  async delete(workspaceId: string, teammateId: string): Promise<void> {
    await this.executeRun(
      "DELETE FROM workspace_teammate WHERE workspace_id = ? AND teammate_id = ?",
      [workspaceId, teammateId],
    );
    await this.publishAttentionChanged(workspaceId);
  }

  private async publishAttentionChanged(workspaceId: string): Promise<void> {
    await publishWorkspaceEvent({ env: this.env }, workspaceId, "attention.changed", {
      action: "teammate",
    });
  }
}
