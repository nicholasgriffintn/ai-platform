import {
  projectFlowSchema,
  projectRecordTriggerSchema,
  type ProjectFlow,
  type ProjectRecordTrigger,
  type NativeRecordChange,
} from "@ngriffin_uk/polychat-schemas";
import { canonicalJson } from "@ngriffin_uk/polychat-utility-core";
import { parseJsonColumn } from "@ngriffin_uk/polychat-utility-server/json";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { ProjectRecordTriggerRow } from "~/infrastructure/database/schema";

export interface StoredProjectRecordTrigger {
  id: string;
  projectId: string;
  tableId: string;
  runnerUserId: number;
  configuration: ProjectRecordTrigger;
  flow: ProjectFlow;
  cursor: number;
  revision: number;
  enabled: boolean;
  error: string | null;
  updatedAt: string;
}

function formatTrigger(row: ProjectRecordTriggerRow): StoredProjectRecordTrigger {
  return {
    id: row.id,
    projectId: row.project_id,
    tableId: row.table_id,
    runnerUserId: row.runner_user_id,
    configuration: parseJsonColumn(row.configuration, projectRecordTriggerSchema),
    flow: parseJsonColumn(row.flow_snapshot, projectFlowSchema),
    cursor: row.cursor,
    revision: row.revision,
    enabled: Boolean(row.enabled),
    error: row.error,
    updatedAt: row.updated_at,
  };
}

const ADMIN_GUARD = `EXISTS (SELECT 1 FROM workspace_member JOIN project ON project.workspace_id = workspace_member.workspace_id
  WHERE project.id = ? AND workspace_member.user_id = ? AND workspace_member.role IN ('owner', 'admin'))`;

export class ProjectRecordTriggerRepository extends BaseRepository {
  async list(projectId: string): Promise<StoredProjectRecordTrigger[]> {
    const rows = await this.runQuery<ProjectRecordTriggerRow>(
      "SELECT * FROM project_record_trigger WHERE project_id = ? ORDER BY trigger_key",
      [projectId],
    );

    return rows.map(formatTrigger);
  }

  async active(): Promise<StoredProjectRecordTrigger[]> {
    const rows = await this.runQuery<ProjectRecordTriggerRow>(
      `SELECT * FROM project_record_trigger WHERE enabled = 1 AND EXISTS
        (SELECT 1 FROM native_record_change WHERE table_id = project_record_trigger.table_id AND sequence > project_record_trigger.cursor)
        ORDER BY updated_at, id LIMIT 100`,
    );

    return rows.map(formatTrigger);
  }

  async saveFlow(
    projectId: string,
    actorUserId: number,
    flow: ProjectFlow | null,
  ): Promise<boolean> {
    const encoded = flow ? canonicalJson(flow) : null;
    const triggers = flow?.recordTriggers ?? [];
    const statements = [
      this.env.DB.prepare(`UPDATE project SET flow = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND ${ADMIN_GUARD}`).bind(encoded, projectId, projectId, actorUserId),
    ];

    for (const trigger of triggers) {
      const configuration = canonicalJson(trigger);

      statements.push(
        this.env.DB.prepare(`INSERT INTO project_record_trigger
        (id, project_id, table_id, trigger_key, runner_user_id, configuration, flow_snapshot, cursor)
        SELECT ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sequence), 0) FROM native_record_change WHERE table_id = ?)
        WHERE ${ADMIN_GUARD}
        ON CONFLICT(project_id, trigger_key) DO UPDATE SET table_id = excluded.table_id,
          runner_user_id = excluded.runner_user_id, configuration = excluded.configuration,
          flow_snapshot = excluded.flow_snapshot, cursor = CASE
            WHEN project_record_trigger.configuration = excluded.configuration AND project_record_trigger.flow_snapshot = excluded.flow_snapshot
              THEN project_record_trigger.cursor ELSE excluded.cursor END,
          revision = project_record_trigger.revision + 1, enabled = 1, error = NULL, updated_at = CURRENT_TIMESTAMP`).bind(
          `${projectId}:${trigger.id}`,
          projectId,
          trigger.tableId,
          trigger.id,
          actorUserId,
          configuration,
          encoded,
          trigger.tableId,
          projectId,
          actorUserId,
        ),
      );
    }

    statements.push(
      this.env.DB.prepare(`DELETE FROM project_record_trigger WHERE project_id = ?
      AND trigger_key NOT IN (SELECT json_extract(value, '$.id') FROM json_each(?, '$.recordTriggers'))
      AND ${ADMIN_GUARD}`).bind(projectId, encoded ?? "{}", projectId, actorUserId),
    );
    const result = await this.env.DB.batch(statements);

    return result[0]?.meta.changes === 1;
  }

  prepareAdvance(
    trigger: StoredProjectRecordTrigger,
    change: NativeRecordChange,
    tableRevision: number,
  ): D1PreparedStatement {
    return this.env.DB.prepare(`UPDATE project_record_trigger SET cursor = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND revision = ? AND cursor = ? AND enabled = 1
        AND EXISTS (SELECT 1 FROM project JOIN workspace_member ON workspace_member.workspace_id = project.workspace_id
          JOIN output ON output.project_id = project.id WHERE project.id = project_record_trigger.project_id
          AND workspace_member.user_id = project_record_trigger.runner_user_id AND output.id = project_record_trigger.table_id
          AND output.kind = 'records' AND output.status = 'ready' AND output.revision = ?
          AND json_extract(output.content, '$.visibility') = 'shared')`).bind(
      change.sequence,
      trigger.id,
      trigger.revision,
      trigger.cursor,
      tableRevision,
    );
  }

  async pause(trigger: StoredProjectRecordTrigger, error: string): Promise<void> {
    await this.executeRun(
      `UPDATE project_record_trigger SET enabled = 0, error = ?, revision = revision + 1,
      updated_at = CURRENT_TIMESTAMP WHERE id = ? AND revision = ?`,
      [error.slice(0, 2000), trigger.id, trigger.revision],
    );
  }
}
