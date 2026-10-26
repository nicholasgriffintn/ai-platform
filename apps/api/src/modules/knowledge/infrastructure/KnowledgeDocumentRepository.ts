import type {
  KnowledgeEnrichmentState,
  SourceKind,
  SourceStatus,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import {
  resourceScope,
  sourceResourceColumns,
  sourceResourceSql,
} from "~/infrastructure/database/resource-storage";
import { sourceVisibilitySql } from "~/modules/sources/infrastructure/source-visibility";
import type { SourceRecord } from "~/modules/sources/infrastructure/SourceRepository";

export interface InsertKnowledgeSourceRecord {
  id: string;
  createdByUserId: number;
  projectId: string | null;
  conversationId?: string | null;
  connectionId?: string | null;
  kind: Exclude<SourceKind, "memory">;
  title: string;
  status: SourceStatus;
  content: string | null;
  provider?: string | null;
  externalUri?: string | null;
  vectorId?: string | null;
  metadata: Record<string, unknown>;
  storageKey?: string | null;
  mimeType?: string | null;
  filename?: string | null;
  byteSize?: number | null;
}

export interface ExpiredKnowledgeSource {
  id: string;
  created_by_user_id: number;
  project_id: string | null;
}

const MUTABLE_SOURCE = `json_extract(metadata, '$.immutableSnapshot') IS NOT 1
  AND NOT EXISTS (SELECT 1 FROM project_task_integration WHERE source_id = resource.id)`;

export class KnowledgeDocumentRepository extends BaseRepository {
  find(sourceId: string): Promise<SourceRecord | null> {
    return this.runQuery<SourceRecord>(
      `SELECT * FROM ${sourceResourceSql} source WHERE id = ?`,
      [sourceId],
      true,
    );
  }

  async insert(
    input: InsertKnowledgeSourceRecord,
  ): Promise<{ source: SourceRecord; created: boolean }> {
    const insert = this.buildInsertQuery(
      "resource",
      {
        resource_type: "source",
        id: input.id || generateId(),
        created_by_user_id: input.createdByUserId,
        ...resourceScope(input.createdByUserId, input.projectId),
        conversation_id: input.conversationId ?? null,
        connection_id: input.connectionId ?? null,
        kind: input.kind,
        title: input.title,
        status: input.status,
        content: input.content,
        provider: input.provider ?? null,
        external_uri: input.externalUri ?? null,
        vector_id: input.vectorId ?? null,
        metadata: input.metadata,
        storage_key: input.storageKey ?? null,
        mime_type: input.mimeType ?? null,
        filename: input.filename ?? null,
        byte_size: input.byteSize ?? null,
      },
      { jsonFields: ["metadata"], returning: sourceResourceColumns },
    );

    if (!insert) {
      throw new AssistantError("Failed to build source insert", ErrorType.INTERNAL_ERROR);
    }

    const source = await this.runQuery<SourceRecord>(
      insert.query.replace(" RETURNING ", " ON CONFLICT(resource_type, id) DO NOTHING RETURNING "),
      insert.values,
      true,
    );

    if (source) {
      return { source, created: true };
    }

    const existing = await this.find(input.id);

    if (
      existing &&
      existing.project_id === input.projectId &&
      existing.created_by_user_id === input.createdByUserId
    ) {
      return { source: existing, created: false };
    }

    throw new AssistantError("Failed to create source", ErrorType.DATABASE_ERROR);
  }

  async update(
    sourceId: string,
    updates: {
      title: string;
      status: SourceStatus;
      metadata: Record<string, unknown>;
      content?: string | null;
      externalUri?: string | null;
    },
  ): Promise<void> {
    const values: Record<string, unknown> = {
      title: updates.title,
      status: updates.status,
      metadata: updates.metadata,
    };

    if (updates.content !== undefined) {
      values.content = updates.content;
    }

    if (updates.externalUri !== undefined) {
      values.external_uri = updates.externalUri;
    }

    const result = this.buildUpdateQuery(
      "resource",
      values,
      Object.keys(values),
      "resource_type = 'source' AND id = ?",
      [sourceId],
      { jsonFields: ["metadata"] },
    );

    if (result) {
      await this.executeRun(result.query, result.values);
    }
  }

  async markBodyChanged(sourceId: string): Promise<void> {
    await this.env.DB.batch([
      this.env.DB.prepare(
        "UPDATE resource SET search_revision = search_revision + 1 WHERE resource_type = 'source' AND id = ?",
      ).bind(sourceId),
      this.env.DB.prepare(
        "UPDATE search_document SET status = 'stale' WHERE document_type = 'source' AND source_id = ?",
      ).bind(sourceId),
    ]);
  }

  async setEnrichment(
    sourceId: string,
    name: string,
    state: KnowledgeEnrichmentState,
    value?: { key: string; value: unknown },
  ): Promise<boolean> {
    const result = await this.executeRun(
      value
        ? `UPDATE resource SET metadata = json_set(COALESCE(metadata, '{}'), '$.enrichments.' || ?, json(?), '$.' || ?, json(?))
           WHERE resource_type = 'source' AND id = ? AND ${MUTABLE_SOURCE}`
        : `UPDATE resource SET metadata = json_set(COALESCE(metadata, '{}'), '$.enrichments.' || ?, json(?))
           WHERE resource_type = 'source' AND id = ? AND ${MUTABLE_SOURCE}`,
      value
        ? [name, JSON.stringify(state), value.key, JSON.stringify(value.value), sourceId]
        : [name, JSON.stringify(state), sourceId],
    );

    return result.meta.changes === 1;
  }

  async setControls(
    sourceId: string,
    controls: {
      retrieval?: "included" | "excluded";
      expiresAt?: string | null;
      sensitivity?: "personal" | "internal" | "confidential" | null;
    },
  ): Promise<void> {
    const statements = [];

    if (controls.retrieval !== undefined) {
      statements.push(
        this.env.DB.prepare(
          `UPDATE resource SET metadata = CASE WHEN ? = 'excluded'
             THEN json_set(COALESCE(metadata, '{}'), '$.retrieval', 'excluded')
             ELSE json_remove(COALESCE(metadata, '{}'), '$.retrieval') END
           WHERE resource_type = 'source' AND id = ? AND ${MUTABLE_SOURCE}`,
        ).bind(controls.retrieval, sourceId),
      );
    }

    if (controls.expiresAt !== undefined) {
      statements.push(
        this.env.DB.prepare(
          `UPDATE resource SET metadata = CASE WHEN ? IS NULL
             THEN json_remove(COALESCE(metadata, '{}'), '$.expiresAt')
             ELSE json_set(COALESCE(metadata, '{}'), '$.expiresAt', ?) END
           WHERE resource_type = 'source' AND id = ? AND ${MUTABLE_SOURCE}`,
        ).bind(controls.expiresAt, controls.expiresAt, sourceId),
      );
    }

    if (controls.sensitivity !== undefined) {
      statements.push(
        this.env.DB.prepare(
          "UPDATE resource SET sensitivity = ? WHERE resource_type = 'source' AND id = ?",
        ).bind(controls.sensitivity, sourceId),
      );
    }

    if (statements.length > 0) {
      await this.env.DB.batch(statements);
    }
  }

  listExpired(limit = 100): Promise<ExpiredKnowledgeSource[]> {
    return this.runQuery<ExpiredKnowledgeSource>(
      `SELECT s.id, s.created_by_user_id, s.project_id FROM ${sourceResourceSql} s
       WHERE s.kind != 'memory' AND json_type(s.metadata, '$.expiresAt') = 'text'
         AND json_extract(s.metadata, '$.expiresAt') <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         AND json_extract(s.metadata, '$.immutableSnapshot') IS NOT 1
         AND ${sourceVisibilitySql("s")}
       LIMIT ?`,
      [limit],
    );
  }

  getSensitivity(
    sourceId: string,
  ): Promise<{ sensitivity: "personal" | "internal" | "confidential" | null } | null> {
    return this.runQuery(
      "SELECT sensitivity FROM resource WHERE resource_type = 'source' AND id = ?",
      [sourceId],
      true,
    );
  }
}
