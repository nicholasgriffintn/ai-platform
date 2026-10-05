import {
  nativeRecordChangeSchema,
  nativeRecordSchema,
  type NativeRecord,
  type NativeRecordDefinition,
  type NativeRecordQuery,
  type NativeRecordValues,
} from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";

import { compileNativeRecordQuery } from "./query";

interface NativeRecordRow {
  id: string;
  table_id: string;
  created_by_user_id: number;
  values_json: string;
  creation_hash: string;
  validated_table_revision: number;
  revision: number;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

interface NativeRecordChangeRow {
  trigger_eligible: number;
  sequence: number;
  table_id: string;
  record_id: string;
  record_revision: number;
  changed_by_user_id: number;
  operation: string;
  record_json: string;
  created_at: string;
}

export interface NativeRecordAccessFence {
  tableRevision: number;
  actorUserId: number;
  projectId: string | null;
  role: string;
  binding?: { outputId: string; revision: number };
  originTaskId?: string;
  flow?: {
    taskId: string;
    flowRevision: number;
    waitId: string;
    dispatchTaskId: string;
    ownerToken: string;
  };
}

const TABLE_ACCESS_FENCE = `id = ? AND kind = 'records' AND revision = ? AND project_id IS ?
  AND ((project_id IS NULL AND created_by_user_id = ?) OR EXISTS (
    SELECT 1 FROM project JOIN workspace_member ON workspace_member.workspace_id = project.workspace_id
    WHERE project.id = output.project_id AND workspace_member.user_id = ? AND workspace_member.role = ?))
  AND (? IS NULL OR EXISTS (SELECT 1 FROM output AS binding WHERE binding.id = ? AND binding.revision = ?))`;

function formatRecord(row: NativeRecordRow): NativeRecord {
  return nativeRecordSchema.parse({
    id: row.id,
    tableId: row.table_id,
    createdByUserId: row.created_by_user_id,
    values: safeParseJson<unknown>(row.values_json),
    revision: row.revision,
    tableRevisionAtWrite: row.validated_table_revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  });
}

export class NativeRecordRepository extends BaseRepository {
  async get(tableId: string, recordId: string, ownerId?: number, fence?: NativeRecordAccessFence) {
    const row = await this.runQuery<NativeRecordRow>(
      `SELECT * FROM native_record WHERE table_id = ? AND id = ?${ownerId === undefined ? "" : " AND created_by_user_id = ?"}${fence ? ` AND ${this.accessFence(fence)}` : ""}`,
      [
        tableId,
        recordId,
        ...(ownerId === undefined ? [] : [ownerId]),
        ...(fence ? this.fenceParameters(tableId, fence) : []),
      ],
      true,
    );

    return row ? { record: formatRecord(row), creationHash: row.creation_hash } : null;
  }

  async cursor(tableId: string): Promise<number> {
    const row = await this.runQuery<{ cursor: number }>(
      "SELECT COALESCE(MAX(sequence), 0) AS cursor FROM native_record_change WHERE table_id = ?",
      [tableId],
      true,
    );

    return row?.cursor ?? 0;
  }

  async list(
    tableId: string,
    definition: NativeRecordDefinition,
    query: NativeRecordQuery,
    fence: NativeRecordAccessFence,
    ownerId?: number,
  ) {
    const compiled = compileNativeRecordQuery(definition, query);
    const parameters = [
      tableId,
      ...(ownerId === undefined ? [] : [ownerId]),
      ...compiled.parameters,
      query.limit + 1,
      query.offset,
    ];
    const results = await this.executeBatch<NativeRecordRow | { cursor: number }>([
      this.env.DB.prepare(
        `SELECT (SELECT COALESCE(MAX(sequence), 0) FROM native_record_change WHERE table_id = ?) AS cursor WHERE ${this.accessFence(fence)}`,
      ).bind(tableId, ...this.fenceParameters(tableId, fence)),
      this.env.DB.prepare(
        `SELECT * FROM native_record WHERE table_id = ? AND deleted_at IS NULL${ownerId === undefined ? "" : " AND created_by_user_id = ?"}${compiled.where} ORDER BY ${compiled.orderBy} LIMIT ? OFFSET ?`,
      ).bind(...parameters),
    ]);
    const cursor = results[0]?.results[0];

    if (!cursor) {
      throw new AssistantError(
        "The table or its permissions have changed. Refresh and try again.",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    const rows = results[1]?.results ?? [];
    const records = rows.slice(0, query.limit).map((row) => {
      if (!("id" in row)) {
        throw new AssistantError("Invalid record row", ErrorType.DATABASE_ERROR);
      }

      return formatRecord(row);
    });

    return {
      records,
      hasMore: rows.length > query.limit,
      changeCursor: cursor && "cursor" in cursor ? cursor.cursor : 0,
    };
  }

  async activeValues(tableId: string, offset: number) {
    const rows = await this.runQuery<{ values_json: string }>(
      "SELECT values_json FROM native_record WHERE table_id = ? AND deleted_at IS NULL ORDER BY id LIMIT 100 OFFSET ?",
      [tableId, offset],
    );

    return rows.map((row) => safeParseJson<unknown>(row.values_json));
  }

  async changes(tableId: string, after: number, fence: NativeRecordAccessFence, ownerId?: number) {
    const results = await this.executeBatch<NativeRecordChangeRow | { authorised: number }>([
      this.env.DB.prepare(`SELECT 1 AS authorised WHERE ${this.accessFence(fence)}`).bind(
        ...this.fenceParameters(tableId, fence),
      ),
      this.env.DB.prepare(
        `SELECT * FROM native_record_change WHERE table_id = ? AND sequence > ?${ownerId === undefined ? "" : " AND record_owner_user_id = ?"} ORDER BY sequence LIMIT 101`,
      ).bind(...(ownerId === undefined ? [tableId, after] : [tableId, after, ownerId])),
    ]);

    if (!results[0]?.results[0]) {
      throw new AssistantError(
        "The table or its permissions have changed. Refresh and try again.",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    const rows = results[1]?.results ?? [];
    const changes = rows.slice(0, 100).map((row) => {
      if (!("sequence" in row)) {
        throw new AssistantError("Invalid record change", ErrorType.DATABASE_ERROR);
      }

      return nativeRecordChangeSchema.parse({
        triggerEligible: Boolean(row.trigger_eligible),
        sequence: row.sequence,
        tableId: row.table_id,
        recordId: row.record_id,
        revision: row.record_revision,
        operation: row.operation,
        changedByUserId: row.changed_by_user_id,
        record: safeParseJson<unknown>(row.record_json),
        createdAt: row.created_at,
      });
    });

    return { changes, nextCursor: changes.at(-1)?.sequence ?? after, hasMore: rows.length > 100 };
  }

  async create(
    input: {
      id: string;
      tableId: string;
      userId: number;
      tableRevision: number;
      values: NativeRecordValues;
      creationHash: string;
    },
    fence: NativeRecordAccessFence,
  ) {
    const now = new Date().toISOString();
    const statement = this.env.DB.prepare(
      `INSERT INTO native_record (id, table_id, created_by_user_id, values_json, creation_hash, validated_table_revision, revision, created_at)
       SELECT ?, ?, ?, ?, ?, ?, 1, ? WHERE ${this.accessFence(fence)} AND EXISTS (SELECT 1 FROM output WHERE id = ? AND status = 'ready') RETURNING *`,
    ).bind(
      input.id,
      input.tableId,
      input.userId,
      JSON.stringify(input.values),
      input.creationHash,
      input.tableRevision,
      now,
      ...this.fenceParameters(input.tableId, fence),
      input.tableId,
    );

    return this.mutate(
      statement,
      input.tableId,
      input.id,
      input.userId,
      "created",
      now,
      fence.originTaskId,
    );
  }

  async update(
    input: {
      tableId: string;
      recordId: string;
      userId: number;
      tableRevision: number;
      expectedRevision: number;
      values: NativeRecordValues;
      deleted?: boolean;
    },
    fence: NativeRecordAccessFence,
  ) {
    const now = new Date().toISOString();
    const statement = this.env.DB.prepare(
      `UPDATE native_record SET values_json = ?, validated_table_revision = ?, revision = revision + 1, updated_at = ?, deleted_at = ?
       WHERE table_id = ? AND id = ? AND revision = ? AND deleted_at IS NULL
       AND ${this.accessFence(fence)} AND EXISTS (SELECT 1 FROM output WHERE id = ? AND status = 'ready') RETURNING *`,
    ).bind(
      JSON.stringify(input.values),
      input.tableRevision,
      now,
      input.deleted ? now : null,
      input.tableId,
      input.recordId,
      input.expectedRevision,
      ...this.fenceParameters(input.tableId, fence),
      input.tableId,
    );

    return this.mutate(
      statement,
      input.tableId,
      input.recordId,
      input.userId,
      input.deleted ? "deleted" : "updated",
      now,
      fence.originTaskId,
    );
  }

  private accessFence(fence: NativeRecordAccessFence) {
    const execution = fence.flow
      ? ` AND EXISTS (
      SELECT 1 FROM project_task JOIN tasks ON tasks.id = project_task.dispatch_task_id
      WHERE project_task.id = ? AND project_task.project_id = output.project_id
        AND project_task.flow_revision = ? AND json_extract(project_task.flow_execution, '$.waitId') = ?
        AND project_task.status = 'running' AND project_task.dispatch_task_id = ?
        AND tasks.status = 'running' AND tasks.execution_owner_token = ?
        AND datetime(tasks.execution_lease_expires_at) > datetime(?))`
      : "";

    return `EXISTS (SELECT 1 FROM output WHERE ${TABLE_ACCESS_FENCE}${execution})`;
  }

  private fenceParameters(tableId: string, fence: NativeRecordAccessFence) {
    return [
      tableId,
      fence.tableRevision,
      fence.projectId,
      fence.actorUserId,
      fence.actorUserId,
      fence.role,
      fence.binding?.outputId ?? null,
      fence.binding?.outputId ?? null,
      fence.binding?.revision ?? null,
      ...(fence.flow
        ? [
            fence.flow.taskId,
            fence.flow.flowRevision,
            fence.flow.waitId,
            fence.flow.dispatchTaskId,
            fence.flow.ownerToken,
            new Date().toISOString(),
          ]
        : []),
    ];
  }

  private async mutate(
    statement: D1PreparedStatement,
    tableId: string,
    recordId: string,
    userId: number,
    operation: "created" | "updated" | "deleted",
    now: string,
    originTaskId?: string,
  ) {
    const journal = this.env.DB.prepare(
      `INSERT INTO native_record_change (table_id, record_id, record_revision, record_owner_user_id, changed_by_user_id, operation, record_json, created_at, trigger_eligible)
       SELECT table_id, id, revision, created_by_user_id, ?, ?, json_object(
         'id', id, 'tableId', table_id, 'createdByUserId', created_by_user_id, 'values', json(values_json),
         'revision', revision, 'tableRevisionAtWrite', validated_table_revision, 'createdAt', created_at,
         'updatedAt', updated_at, 'deletedAt', deleted_at), ?,
         CASE WHEN EXISTS (SELECT 1 FROM project_task WHERE id = ? AND source = 'record_trigger') THEN 0 ELSE 1 END
       FROM native_record WHERE table_id = ? AND id = ? AND changes() = 1`,
    ).bind(userId, operation, now, originTaskId ?? null, tableId, recordId);

    try {
      const results = await this.executeBatch<NativeRecordRow>([statement, journal]);
      const row = results[0]?.results[0];

      if (!row) {
        throw new AssistantError(
          "The table or record has changed. Refresh and try again.",
          ErrorType.CONFLICT_ERROR,
          409,
        );
      }

      return formatRecord(row);
    } catch (error) {
      if (getErrorMessage(error).includes("native_record_limit")) {
        throw new AssistantError(
          "A table can hold up to 10,000 active records",
          ErrorType.PARAMS_ERROR,
          400,
        );
      }

      if (getErrorMessage(error).includes("UNIQUE constraint failed: native_record.id")) {
        throw new AssistantError(
          "The request ID already belongs to a record",
          ErrorType.CONFLICT_ERROR,
          409,
        );
      }

      throw error;
    }
  }
}
