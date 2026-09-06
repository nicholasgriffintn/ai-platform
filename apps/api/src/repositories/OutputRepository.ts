import type {
  OutputProvenance,
  OutputRevisionOperation,
  OutputSensitivity,
  OutputStatus,
} from "@ngriffin_uk/polychat-schemas";

import { KVCache } from "~/lib/cache";
import { isOutputDeletionPending } from "~/lib/outputs/deletion";
import {
  addOutputProvenanceSources,
  createOutputProvenance,
  parseOutputProvenance,
} from "~/lib/provenance/output";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

import { BaseRepository } from "./BaseRepository";

export interface OutputRecord {
  id: string;
  created_by_user_id: number;
  project_id: string | null;
  conversation_id: string | null;
  parent_output_id: string | null;
  capability_id: string;
  group_id: string | null;
  kind: string;
  title: string;
  status: OutputStatus;
  sensitivity: OutputSensitivity;
  content: string;
  storage_key: string | null;
  mime_type: string | null;
  filename: string | null;
  byte_size: number | null;
  revision: number;
  provenance_json?: unknown;
  revision_created_by_user_id?: number | null;
  revision_created_at?: string | null;
  revision_operation?: OutputRevisionOperation | null;
  restored_from_revision?: number | null;
  created_at: string;
  updated_at: string | null;
}

export interface CreateOutputRecord {
  id?: string;
  createdByUserId: number;
  projectId?: string | null;
  conversationId?: string | null;
  parentOutputId?: string | null;
  capabilityId: string;
  groupId?: string | null;
  kind: string;
  title: string;
  status?: OutputStatus;
  sensitivity?: OutputSensitivity;
  content?: unknown;
  storageKey?: string | null;
  mimeType?: string | null;
  filename?: string | null;
  byteSize?: number | null;
  provenance?: OutputProvenance;
}

export interface UpdateOutputRecord {
  title?: string;
  status?: OutputStatus;
  sensitivity?: OutputSensitivity;
  content?: unknown;
  expectedRevision: number;
  updatedByUserId: number;
  operation?: Exclude<OutputRevisionOperation, "created">;
  restoredFromRevision?: number | null;
}

export interface OutputAuditRecord {
  workspaceId: string;
  actorUserId: number;
  action: "output.created" | "output.updated" | "output.restored" | "output.deleted";
  outputId: string;
  metadata: Record<string, unknown>;
}

export interface OutputShareRecord {
  id: string;
  output_id: string;
  token_hash: string;
  permission: "view";
  created_by_user_id: number;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface OutputRevisionRecord {
  output_id: string;
  revision: number;
  title: string;
  status: OutputStatus;
  sensitivity: OutputSensitivity;
  content: string;
  provenance_json?: unknown;
  operation?: OutputRevisionOperation | null;
  restored_from_revision?: number | null;
  created_by_user_id: number;
  created_at: string;
}

interface OutputListOptions {
  kind?: string;
  limit?: number;
  offset?: number;
}

const OUTPUT_CACHE_TTL = 900;

export class OutputRepository extends BaseRepository {
  private cache: KVCache | null = null;

  constructor(env: IEnv) {
    super(env);
    if (env.CACHE) {
      this.cache = new KVCache(env.CACHE, OUTPUT_CACHE_TTL);
    }
  }

  async createOutput(input: CreateOutputRecord, audit?: OutputAuditRecord): Promise<OutputRecord> {
    const id = input.id ?? generateId();
    const provenance =
      input.provenance ?? createOutputProvenance({ origin: "unknown", completeness: "partial" });
    const revisionCreatedAt = new Date().toISOString();
    const insert = this.buildInsertQuery(
      "output",
      {
        id,
        created_by_user_id: input.createdByUserId,
        project_id: input.projectId ?? null,
        conversation_id: input.conversationId ?? null,
        parent_output_id: input.parentOutputId ?? null,
        capability_id: input.capabilityId,
        group_id: input.groupId ?? null,
        kind: input.kind,
        title: input.title,
        status: input.status ?? "ready",
        sensitivity: input.sensitivity ?? (input.projectId ? "internal" : "personal"),
        content: input.content ?? {},
        storage_key: input.storageKey ?? null,
        mime_type: input.mimeType ?? null,
        filename: input.filename ?? null,
        byte_size: input.byteSize ?? null,
        provenance_json: provenance,
        revision_created_by_user_id: input.createdByUserId,
        revision_created_at: revisionCreatedAt,
        revision_operation: "created",
        restored_from_revision: null,
      },
      { jsonFields: ["content", "provenance_json"], returning: "*" },
    );

    if (!insert) {
      throw new AssistantError("Failed to build output insert query", ErrorType.INTERNAL_ERROR);
    }

    if (audit) {
      if (!this.env.DB) {
        throw new AssistantError("Database is not configured", ErrorType.CONFIGURATION_ERROR);
      }

      const auditInsert = this.buildInsertQuery(
        "workspace_audit_record",
        {
          id: generateId(),
          workspace_id: audit.workspaceId,
          actor_user_id: audit.actorUserId,
          action: audit.action,
          target_type: "output",
          target_id: audit.outputId,
          metadata: audit.metadata,
        },
        { jsonFields: ["metadata"] },
      );

      if (!auditInsert) {
        throw new AssistantError("Failed to build output audit query", ErrorType.INTERNAL_ERROR);
      }

      const results = await this.env.DB.batch([
        this.env.DB.prepare(insert.query).bind(...insert.values),
        this.env.DB.prepare(auditInsert.query).bind(...auditInsert.values),
      ]);

      if (!results.every((result) => result.success)) {
        throw new AssistantError("Failed to create output", ErrorType.DATABASE_ERROR);
      }
    } else {
      const output = await this.runQuery<OutputRecord>(insert.query, insert.values, true);

      if (!output) {
        throw new AssistantError("Failed to create output", ErrorType.DATABASE_ERROR);
      }
    }

    await this.cache?.delete(KVCache.createKey("output", id));
    const output = await this.getOutput(id);

    if (!output) {
      throw new AssistantError("Failed to create output", ErrorType.DATABASE_ERROR);
    }

    return output;
  }

  async getOutputIncludingDeleting(outputId: string): Promise<OutputRecord | null> {
    const cacheKey = KVCache.createKey("output", outputId);

    if (this.cache) {
      return this.cache.cacheQuery(cacheKey, () => this.selectOne({ id: outputId }), {
        ttl: OUTPUT_CACHE_TTL,
      });
    }

    return this.selectOne({ id: outputId });
  }

  async getOutput(outputId: string): Promise<OutputRecord | null> {
    const output = await this.getOutputIncludingDeleting(outputId);

    return output && !isOutputDeletionPending(output) ? output : null;
  }

  async getPersonalOutput(userId: number, outputId: string): Promise<OutputRecord | null> {
    const output = await this.selectOne({
      id: outputId,
      created_by_user_id: userId,
      project_id: null,
    });

    return output && !isOutputDeletionPending(output) ? output : null;
  }

  async getProjectOutput(projectId: string, outputId: string): Promise<OutputRecord | null> {
    const output = await this.selectOne({ id: outputId, project_id: projectId });

    return output && !isOutputDeletionPending(output) ? output : null;
  }

  async getOutputByGroupId(groupId: string): Promise<OutputRecord | null> {
    const output = await this.selectOne({ group_id: groupId });

    return output && !isOutputDeletionPending(output) ? output : null;
  }

  async getPersonalOutputByGroup(
    userId: number,
    groupId: string,
    kind?: string,
  ): Promise<OutputRecord | null> {
    const output = await this.selectOne({
      created_by_user_id: userId,
      project_id: null,
      group_id: groupId,
      kind,
    });

    return output && !isOutputDeletionPending(output) ? output : null;
  }

  async getOutputByCapabilityAndGroup(
    capabilityId: string,
    groupId: string,
  ): Promise<OutputRecord | null> {
    const output = await this.selectOne({ capability_id: capabilityId, group_id: groupId });

    return output && !isOutputDeletionPending(output) ? output : null;
  }

  async listOutputDescendants(parentOutputId: string): Promise<OutputRecord[]> {
    return this.runQuery<OutputRecord>(
      `WITH RECURSIVE descendants AS (
         SELECT * FROM output WHERE parent_output_id = ?
         UNION ALL
         SELECT child.*
         FROM output child
         INNER JOIN descendants parent ON child.parent_output_id = parent.id
       )
       SELECT * FROM descendants`,
      [parentOutputId],
      false,
    );
  }

  async listWorkspaceOutputRoots(workspaceId: string): Promise<OutputRecord[]> {
    return this.runQuery<OutputRecord>(
      `SELECT child.*
       FROM output child
       INNER JOIN project ON project.id = child.project_id
       WHERE project.workspace_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM output parent
           WHERE parent.id = child.parent_output_id
             AND parent.project_id = child.project_id
         )
       ORDER BY child.created_at ASC`,
      [workspaceId],
      false,
    );
  }

  async listPersonalOutputs(
    userId: number,
    capabilityId?: string,
    options: OutputListOptions = {},
  ): Promise<OutputRecord[]> {
    return this.listScopedOutputs("created_by_user_id", userId, capabilityId, options, true);
  }

  async listProjectOutputs(
    projectId: string,
    capabilityId?: string,
    options: OutputListOptions = {},
  ): Promise<OutputRecord[]> {
    return this.listScopedOutputs("project_id", projectId, capabilityId, options, false);
  }

  async listProjectOutputsForRuns(
    projectId: string,
    runIds: readonly string[],
  ): Promise<OutputRecord[]> {
    const uniqueRunIds = [...new Set(runIds)];

    if (uniqueRunIds.length === 0) {
      return [];
    }

    const placeholders = uniqueRunIds.map(() => "?").join(", ");

    return this.runQuery<OutputRecord>(
      `SELECT * FROM output
       WHERE project_id = ?
         AND json_extract(provenance_json, '$.run.id') IN (${placeholders})
       ORDER BY created_at ASC`,
      [projectId, ...uniqueRunIds],
    );
  }

  private async listScopedOutputs(
    scopeField: "created_by_user_id" | "project_id",
    scopeValue: number | string,
    capabilityId: string | undefined,
    options: OutputListOptions,
    personal: boolean,
  ): Promise<OutputRecord[]> {
    const conditions = [`${scopeField} = ?`];
    const values: unknown[] = [scopeValue];

    if (personal) {
      conditions.push("project_id IS NULL");
    }

    if (capabilityId) {
      conditions.push("capability_id = ?");
      values.push(capabilityId);
    }

    if (options.kind) {
      conditions.push("kind = ?");
      values.push(options.kind);
    }

    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;

    values.push(limit, offset);

    const outputs = await this.runQuery<OutputRecord>(
      `SELECT * FROM output WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      values,
      false,
    );

    return outputs.filter((output) => !isOutputDeletionPending(output));
  }

  async listPersonalOutputGroup(
    userId: number,
    capabilityId: string,
    groupId: string,
    kind?: string,
  ): Promise<OutputRecord[]> {
    const outputs = await this.selectMany({
      created_by_user_id: userId,
      project_id: null,
      capability_id: capabilityId,
      group_id: groupId,
      kind,
    });

    return outputs.filter((output) => !isOutputDeletionPending(output));
  }

  async listProjectOutputGroup(
    projectId: string,
    capabilityId: string,
    groupId: string,
    kind?: string,
  ): Promise<OutputRecord[]> {
    const outputs = await this.selectMany({
      project_id: projectId,
      capability_id: capabilityId,
      group_id: groupId,
      kind,
    });

    return outputs.filter((output) => !isOutputDeletionPending(output));
  }

  async updateOutput(
    outputId: string,
    input: UpdateOutputRecord,
    audit?: OutputAuditRecord,
  ): Promise<OutputRecord> {
    const existing = await this.getOutputIncludingDeleting(outputId);

    if (!existing) {
      throw new AssistantError("Output not found", ErrorType.NOT_FOUND, 404);
    }

    if (existing.revision !== input.expectedRevision) {
      throw new AssistantError("Output has changed", ErrorType.CONFLICT_ERROR, 409);
    }

    const nextRevision = existing.revision + 1;
    const update = this.buildUpdateQuery(
      "output",
      {
        title: input.title,
        status: input.status,
        sensitivity: input.sensitivity,
        content: input.content,
        revision: nextRevision,
        revision_created_by_user_id: input.updatedByUserId,
        revision_created_at: new Date().toISOString(),
        revision_operation: input.operation ?? "updated",
        restored_from_revision: input.restoredFromRevision ?? null,
      },
      [
        "title",
        "status",
        "sensitivity",
        "content",
        "revision",
        "revision_created_by_user_id",
        "revision_created_at",
        "revision_operation",
        "restored_from_revision",
      ],
      "id = ? AND revision = ?",
      [outputId, input.expectedRevision],
      { jsonFields: ["content"] },
    );

    if (!update || !this.env.DB) {
      throw new AssistantError("Failed to build output update query", ErrorType.INTERNAL_ERROR);
    }

    const revisionInsert = this.env.DB.prepare(
      `INSERT OR IGNORE INTO output_revision
			 (output_id, revision, title, status, sensitivity, content, provenance_json,
			  created_by_user_id, created_at, operation, restored_from_revision)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      outputId,
      existing.revision,
      existing.title,
      existing.status,
      existing.sensitivity,
      existing.content,
      existing.provenance_json == null
        ? null
        : typeof existing.provenance_json === "string"
          ? existing.provenance_json
          : JSON.stringify(existing.provenance_json),
      existing.revision_created_by_user_id ?? existing.created_by_user_id,
      existing.revision_created_at ?? existing.updated_at ?? existing.created_at,
      existing.revision_operation ?? (existing.revision === 1 ? "created" : "updated"),
      existing.restored_from_revision ?? null,
    );
    const updateStatement = this.env.DB.prepare(update.query).bind(...update.values);
    const statements = [revisionInsert, updateStatement];

    if (audit) {
      const auditInsert = this.buildInsertQuery(
        "workspace_audit_record",
        {
          id: generateId(),
          workspace_id: audit.workspaceId,
          actor_user_id: audit.actorUserId,
          action: audit.action,
          target_type: "output",
          target_id: audit.outputId,
          metadata: audit.metadata,
        },
        { jsonFields: ["metadata"] },
      );

      if (!auditInsert) {
        throw new AssistantError("Failed to build output audit query", ErrorType.INTERNAL_ERROR);
      }

      statements.push(this.env.DB.prepare(auditInsert.query).bind(...auditInsert.values));
    }

    const results = await this.env.DB.batch(statements);

    if (!results.every((result) => result.success)) {
      throw new AssistantError("Failed to update output", ErrorType.DATABASE_ERROR);
    }

    if (results[1]?.meta?.changes !== 1) {
      throw new AssistantError("Output has changed", ErrorType.CONFLICT_ERROR, 409);
    }

    await this.cache?.delete(KVCache.createKey("output", outputId));
    const updated = await this.getOutputIncludingDeleting(outputId);

    if (!updated || updated.revision !== nextRevision) {
      throw new AssistantError("Output update conflicted", ErrorType.CONFLICT_ERROR, 409);
    }

    return updated;
  }

  async deleteOutput(outputId: string): Promise<void> {
    const { query, values } = this.buildDeleteQuery("output", { id: outputId });

    await this.executeRun(query, values);
    await this.cache?.delete(KVCache.createKey("output", outputId));
  }

  async deleteOutputs(outputIds: string[], audit?: OutputAuditRecord): Promise<void> {
    if (outputIds.length === 0) {
      return;
    }

    const placeholders = outputIds.map(() => "?").join(", ");
    const deleteQuery = `DELETE FROM output WHERE id IN (${placeholders})`;

    if (audit) {
      if (!this.env.DB) {
        throw new AssistantError("Database is not configured", ErrorType.CONFIGURATION_ERROR);
      }

      const auditInsert = this.buildInsertQuery(
        "workspace_audit_record",
        {
          id: generateId(),
          workspace_id: audit.workspaceId,
          actor_user_id: audit.actorUserId,
          action: audit.action,
          target_type: "output",
          target_id: audit.outputId,
          metadata: audit.metadata,
        },
        { jsonFields: ["metadata"] },
      );

      if (!auditInsert) {
        throw new AssistantError("Failed to build output audit query", ErrorType.INTERNAL_ERROR);
      }

      const results = await this.env.DB.batch([
        this.env.DB.prepare(deleteQuery).bind(...outputIds),
        this.env.DB.prepare(auditInsert.query).bind(...auditInsert.values),
      ]);

      if (!results.every((result) => result.success)) {
        throw new AssistantError("Failed to delete outputs", ErrorType.DATABASE_ERROR);
      }
    } else {
      await this.executeRun(deleteQuery, outputIds);
    }

    await Promise.all(
      outputIds.map((outputId) => this.cache?.delete(KVCache.createKey("output", outputId))),
    );
  }

  async deletePersonalOutputGroup(
    userId: number,
    capabilityId: string,
    groupId: string,
    kind?: string,
  ): Promise<void> {
    const { query, values } = this.buildDeleteQuery("output", {
      created_by_user_id: userId,
      project_id: null,
      capability_id: capabilityId,
      group_id: groupId,
      kind,
    });

    await this.executeRun(query, values);
  }

  async deleteProjectOutputGroup(
    projectId: string,
    capabilityId: string,
    groupId: string,
    kind?: string,
  ): Promise<void> {
    const { query, values } = this.buildDeleteQuery("output", {
      project_id: projectId,
      capability_id: capabilityId,
      group_id: groupId,
      kind,
    });

    await this.executeRun(query, values);
  }

  async attachSources(outputId: string, sourceIds: string[]): Promise<void> {
    if (!this.env.DB || sourceIds.length === 0) {
      return;
    }

    const output = await this.getOutputIncludingDeleting(outputId);

    if (!output) {
      return;
    }

    const provenance = addOutputProvenanceSources(
      parseOutputProvenance(output.provenance_json, output.created_at),
      sourceIds,
    );
    const statements = [
      ...sourceIds.map((sourceId) =>
        this.env.DB.prepare(
          "INSERT OR IGNORE INTO output_source (output_id, source_id) VALUES (?, ?)",
        ).bind(outputId, sourceId),
      ),
      this.env.DB.prepare("UPDATE output SET provenance_json = ? WHERE id = ?").bind(
        JSON.stringify(provenance),
        outputId,
      ),
    ];
    const results = await this.env.DB.batch(statements);

    if (!results.every((result) => result.success)) {
      throw new AssistantError("Failed to attach output sources", ErrorType.DATABASE_ERROR);
    }

    await this.cache?.delete(KVCache.createKey("output", outputId));
  }

  async createShare(input: {
    id: string;
    outputId: string;
    tokenHash: string;
    createdByUserId: number;
    expiresAt?: string | null;
  }): Promise<OutputShareRecord> {
    const insert = this.buildInsertQuery(
      "output_share",
      {
        id: input.id,
        output_id: input.outputId,
        token_hash: input.tokenHash,
        permission: "view",
        created_by_user_id: input.createdByUserId,
        expires_at: input.expiresAt ?? null,
      },
      { returning: "*" },
    );

    if (!insert) {
      throw new AssistantError("Failed to create share", ErrorType.INTERNAL_ERROR);
    }

    const share = await this.runQuery<OutputShareRecord>(insert.query, insert.values, true);

    if (!share) {
      throw new AssistantError("Failed to create share", ErrorType.DATABASE_ERROR);
    }

    return share;
  }

  async getShareByTokenHash(tokenHash: string): Promise<OutputShareRecord | null> {
    const { query, values } = this.buildSelectQuery("output_share", { token_hash: tokenHash });

    return this.runQuery<OutputShareRecord>(query, values, true);
  }

  async listShares(outputId: string): Promise<OutputShareRecord[]> {
    const { query, values } = this.buildSelectQuery(
      "output_share",
      { output_id: outputId },
      { orderBy: "created_at DESC" },
    );

    return this.runQuery<OutputShareRecord>(query, values);
  }

  async revokeShare(outputId: string, shareId: string): Promise<void> {
    await this.executeRun(
      "UPDATE output_share SET revoked_at = ? WHERE id = ? AND output_id = ? AND revoked_at IS NULL",
      [new Date().toISOString(), shareId, outputId],
    );
  }

  async listRevisions(outputId: string): Promise<OutputRevisionRecord[]> {
    const { query, values } = this.buildSelectQuery(
      "output_revision",
      { output_id: outputId },
      { orderBy: "revision DESC" },
    );

    return this.runQuery<OutputRevisionRecord>(query, values);
  }

  async getRevision(outputId: string, revision: number): Promise<OutputRevisionRecord | null> {
    const { query, values } = this.buildSelectQuery("output_revision", {
      output_id: outputId,
      revision,
    });

    return this.runQuery<OutputRevisionRecord>(query, values, true);
  }

  private async selectOne(conditions: Record<string, unknown>): Promise<OutputRecord | null> {
    const { query, values } = this.buildSelectQuery("output", conditions);

    return this.runQuery<OutputRecord>(query, values, true);
  }

  private async selectMany(conditions: Record<string, unknown>): Promise<OutputRecord[]> {
    const { query, values } = this.buildSelectQuery("output", conditions, {
      orderBy: "updated_at DESC, created_at DESC",
    });

    return this.runQuery<OutputRecord>(query, values);
  }
}
