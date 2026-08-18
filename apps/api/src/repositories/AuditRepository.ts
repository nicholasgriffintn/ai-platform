import { generateId } from "~/utils/id";

import { BaseRepository } from "./BaseRepository";

export interface WorkspaceAuditRecordRow {
  id: string;
  workspace_id: string;
  actor_user_id: number | null;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: string;
  created_at: string;
}

export class AuditRepository extends BaseRepository {
  async createRecord(input: {
    workspaceId: string;
    actorUserId?: number | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const insert = this.buildInsertQuery(
      "workspace_audit_record",
      {
        id: generateId(),
        workspace_id: input.workspaceId,
        actor_user_id: input.actorUserId ?? null,
        action: input.action,
        target_type: input.targetType,
        target_id: input.targetId ?? null,
        metadata: input.metadata ?? {},
      },
      { jsonFields: ["metadata"] },
    );

    if (insert) {
      await this.executeRun(insert.query, insert.values);
    }
  }

  async listRecords(
    workspaceId: string,
    options: { limit: number; after?: string },
  ): Promise<WorkspaceAuditRecordRow[]> {
    const afterClause = options.after ? "AND created_at < ?" : "";

    return this.runQuery<WorkspaceAuditRecordRow>(
      `SELECT * FROM workspace_audit_record
			 WHERE workspace_id = ? ${afterClause}
			 ORDER BY created_at DESC, id DESC LIMIT ?`,
      options.after ? [workspaceId, options.after, options.limit] : [workspaceId, options.limit],
    );
  }
}
