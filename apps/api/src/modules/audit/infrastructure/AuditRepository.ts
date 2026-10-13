import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";

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

export interface CreateWorkspaceAuditRecordInput {
  workspaceId: string;
  actorUserId?: number | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface WorkspaceAuditRecordInsertValues {
  id: string;
  workspace_id: string;
  actor_user_id: number | null;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
}

export function buildWorkspaceAuditRecordValues(
  input: CreateWorkspaceAuditRecordInput,
): WorkspaceAuditRecordInsertValues {
  return {
    id: generateId(),
    workspace_id: input.workspaceId,
    actor_user_id: input.actorUserId ?? null,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    metadata: input.metadata ?? {},
  };
}

export class AuditRepository extends BaseRepository {
  async createRecord(input: CreateWorkspaceAuditRecordInput): Promise<void> {
    const insert = this.recordInsert(input);

    await this.executeRun(insert.query, insert.values);
  }

  prepareRecord(input: CreateWorkspaceAuditRecordInput): D1PreparedStatement {
    const insert = this.recordInsert(input);

    return this.env.DB.prepare(insert.query).bind(...insert.values);
  }

  private recordInsert(input: CreateWorkspaceAuditRecordInput) {
    const values = buildWorkspaceAuditRecordValues(input);
    const insert = this.buildInsertQuery(
      "workspace_audit_record",
      { ...values },
      { jsonFields: ["metadata"] },
    );

    if (!insert) {
      throw new AssistantError("Failed to prepare audit record", ErrorType.INTERNAL_ERROR);
    }

    return insert;
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

  async lastActionAt(input: {
    workspaceId: string;
    targetType: string;
    targetId: string;
    action: string;
  }): Promise<string | null> {
    const [record] = await this.runQuery<{ created_at: string }>(
      `SELECT created_at FROM workspace_audit_record
       WHERE workspace_id = ? AND target_type = ? AND target_id = ? AND action = ?
       ORDER BY created_at DESC LIMIT 1`,
      [input.workspaceId, input.targetType, input.targetId, input.action],
    );

    return record?.created_at ?? null;
  }

  async listModelRecords(
    workspaceId: string,
    filters: { targetType?: string; targetId?: string; limit: number },
  ): Promise<WorkspaceAuditRecordRow[]> {
    const conditions = ["workspace_id = ?", "target_type LIKE 'model_%'"];
    const params: Array<string | number> = [workspaceId];

    if (filters.targetType) {
      conditions.push("target_type = ?");
      params.push(filters.targetType);
    }

    if (filters.targetId) {
      conditions.push("target_id = ?");
      params.push(filters.targetId);
    }

    params.push(filters.limit);

    return this.runQuery<WorkspaceAuditRecordRow>(
      `SELECT * FROM workspace_audit_record
       WHERE ${conditions.join(" AND ")}
       ORDER BY created_at DESC, id DESC LIMIT ?`,
      params,
    );
  }
}
