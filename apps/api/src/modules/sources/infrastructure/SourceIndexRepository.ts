import type { KnowledgeIndexStatus } from "@ngriffin_uk/polychat-schemas";
import { toFtsQuery } from "@ngriffin_uk/polychat-utility-core";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { PendingEmbeddingChunk } from "~/modules/apps/application/embeddings/document";

import { sourceVisibilitySql } from "./source-visibility";
import type { SourceRecord } from "./SourceRepository";

export interface KnowledgeScope {
  userId: number;
  projectId?: string;
}

export interface SourceIndexRecord {
  id: string;
  source_id: string;
  revision: number;
  created_by_user_id: number;
  target: string;
  lifecycle_status: "pending" | "active" | "failed";
  indexed_at: string | null;
}

export interface IndexedSourceChunk {
  id: string;
  vector_id: string;
  chunk_index: number;
  content: string;
  title: string;
  source_id: string;
  kind: string;
  external_uri: string | null;
  updated_at: string | null;
  target: string;
  created_by_user_id: number;
}

const CURRENT_INDEX_JOIN = `FROM source_chunk c
  JOIN source_index i ON i.id = c.index_id
  JOIN source s ON s.id = i.source_id AND s.knowledge_revision = i.revision
  LEFT JOIN provider_connection pc ON pc.id = s.connection_id
  WHERE s.status = 'available'
    AND (s.connection_id IS NULL OR pc.status = 'connected') AND ${sourceVisibilitySql("s")}`;

export class SourceIndexRepository extends BaseRepository {
  async getSnapshot(
    sourceId: string,
  ): Promise<(SourceRecord & { knowledge_revision: number }) | null> {
    return this.runQuery<SourceRecord & { knowledge_revision: number }>(
      "SELECT * FROM source WHERE id = ?",
      [sourceId],
      true,
    );
  }

  async getSourceRevision(sourceId: string): Promise<number | null> {
    const row = await this.runQuery<{ knowledge_revision: number }>(
      "SELECT knowledge_revision FROM source WHERE id = ?",
      [sourceId],
      true,
    );

    return row?.knowledge_revision ?? null;
  }

  async getCurrentIndex(sourceId: string, revision: number): Promise<SourceIndexRecord | null> {
    return this.runQuery<SourceIndexRecord>(
      "SELECT * FROM source_index WHERE source_id = ? AND revision = ?",
      [sourceId, revision],
      true,
    );
  }

  async prepare(input: {
    id: string;
    sourceId: string;
    revision: number;
    userId: number;
    target: string;
    title: string;
    chunks: PendingEmbeddingChunk[];
  }): Promise<void> {
    await this.executeBatch([
      this.env.DB.prepare(`INSERT INTO source_index (id, source_id, revision, created_by_user_id, target, lifecycle_status)
        VALUES (?, ?, ?, ?, ?, 'pending')`).bind(
        input.id,
        input.sourceId,
        input.revision,
        input.userId,
        input.target,
      ),
      this.env.DB.prepare(`INSERT INTO source_chunk (id, index_id, vector_id, chunk_index, title, content)
        SELECT json_extract(value, '$.id'), ?, json_extract(value, '$.vectorId'), json_extract(value, '$.index'), ?, json_extract(value, '$.content')
        FROM json_each(?)`).bind(input.id, input.title, JSON.stringify(input.chunks)),
    ]);
  }

  async activate(indexId: string): Promise<boolean> {
    const result = await this.executeRun(
      `UPDATE source_index SET lifecycle_status = 'active', indexed_at = CURRENT_TIMESTAMP
      WHERE id = ? AND lifecycle_status = 'pending' AND EXISTS (
        SELECT 1 FROM source s LEFT JOIN provider_connection pc ON pc.id = s.connection_id
        WHERE s.id = source_index.source_id AND s.knowledge_revision = source_index.revision
          AND s.status = 'available' AND (s.connection_id IS NULL OR pc.status = 'connected')
      )`,
      [indexId],
    );

    return result.meta.changes === 1;
  }

  async fail(indexId: string): Promise<void> {
    await this.executeRun(
      "UPDATE source_index SET lifecycle_status = 'failed' WHERE id = ? AND lifecycle_status = 'pending'",
      [indexId],
    );
  }

  async getVectorIds(indexId: string): Promise<string[]> {
    const chunks = await this.runQuery<{ vector_id: string }>(
      "SELECT vector_id FROM source_chunk WHERE index_id = ?",
      [indexId],
    );

    return chunks.map((chunk) => chunk.vector_id);
  }

  async getChunks(indexId: string): Promise<PendingEmbeddingChunk[]> {
    return this.runQuery<PendingEmbeddingChunk>(
      "SELECT id, vector_id AS vectorId, chunk_index AS 'index', content FROM source_chunk WHERE index_id = ? ORDER BY chunk_index",
      [indexId],
    );
  }

  async resume(indexId: string): Promise<void> {
    await this.executeRun(
      "UPDATE source_index SET lifecycle_status = 'pending' WHERE id = ? AND lifecycle_status = 'failed'",
      [indexId],
    );
  }

  async remove(indexId: string): Promise<void> {
    await this.executeBatch([
      this.env.DB.prepare(`DELETE FROM embedding_document WHERE id = (SELECT legacy_document_id FROM source_index WHERE id = ?)
        AND user_id = (SELECT created_by_user_id FROM source_index WHERE id = ?)`).bind(
        indexId,
        indexId,
      ),
      this.env.DB.prepare("DELETE FROM source_index WHERE id = ?").bind(indexId),
    ]);
  }

  async listObsolete(limit = 20): Promise<SourceIndexRecord[]> {
    return this.runQuery<SourceIndexRecord>(
      `SELECT i.* FROM source_index i LEFT JOIN source s ON s.id = i.source_id
      WHERE (s.id IS NULL OR s.knowledge_revision <> i.revision OR s.status = 'archived')
      AND (i.cleanup_after IS NULL OR datetime(i.cleanup_after) <= datetime('now'))
      ORDER BY i.created_at LIMIT ?`,
      [limit],
    );
  }

  async deferCleanup(indexId: string): Promise<void> {
    await this.executeRun(
      "UPDATE source_index SET cleanup_after = datetime('now', '+5 minutes') WHERE id = ?",
      [indexId],
    );
  }

  async listPendingSources(
    limit = 20,
  ): Promise<Array<{ id: string; user_id: number; project_id: string | null; revision: number }>> {
    return this.runQuery(
      `SELECT s.id, s.created_by_user_id AS user_id, s.project_id, s.knowledge_revision AS revision
      FROM source s LEFT JOIN source_index i ON i.source_id = s.id AND i.revision = s.knowledge_revision
      WHERE s.status = 'available' AND s.kind <> 'memory' AND (
        length(trim(s.content)) > 0 OR (s.kind = 'file' AND s.storage_key IS NOT NULL
          AND s.mime_type NOT LIKE 'image/%' AND s.mime_type NOT LIKE 'audio/%' AND s.mime_type NOT LIKE 'video/%')
      ) AND ${sourceVisibilitySql("s")}
        AND i.id IS NULL ORDER BY s.updated_at, s.created_at LIMIT ?`,
      [limit],
    );
  }

  async invalidate(sourceId: string): Promise<void> {
    await this.executeRun(
      "UPDATE source SET knowledge_revision = knowledge_revision + 1 WHERE id = ?",
      [sourceId],
    );
  }

  async storeExtraction(sourceId: string, revision: number, content: string): Promise<void> {
    await this.executeRun(
      "UPDATE source SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND knowledge_revision = ? AND content IS NULL AND status = 'available'",
      [content, sourceId, revision],
    );
  }

  async listTargets(
    scope: KnowledgeScope,
  ): Promise<Array<{ target: string; created_by_user_id: number }>> {
    return this.runQuery(
      `SELECT DISTINCT i.target, i.created_by_user_id ${CURRENT_INDEX_JOIN}
      AND i.lifecycle_status = 'active'
      AND ${scope.projectId ? "s.project_id = ?" : "s.project_id IS NULL AND s.created_by_user_id = ?"} LIMIT 9`,
      [scope.projectId ?? scope.userId],
    );
  }

  async searchKeywords(
    scope: KnowledgeScope,
    query: string,
    type?: string,
  ): Promise<IndexedSourceChunk[]> {
    const match = toFtsQuery(query);

    if (!match) {
      return [];
    }

    return this.runQuery<IndexedSourceChunk>(
      `SELECT c.*, s.id AS source_id, s.kind, s.external_uri, s.updated_at, i.target, i.created_by_user_id
      ${CURRENT_INDEX_JOIN} AND c.rowid IN (SELECT rowid FROM source_chunk_fts WHERE source_chunk_fts MATCH ?)
      AND ${scope.projectId ? "s.project_id = ?" : "s.project_id IS NULL AND s.created_by_user_id = ?"}
      ${type ? "AND s.kind = ?" : ""}
      ORDER BY (SELECT rank FROM source_chunk_fts WHERE rowid = c.rowid AND source_chunk_fts MATCH ?) ASC LIMIT 30`,
      [match, scope.projectId ?? scope.userId, ...(type ? [type] : []), match],
    );
  }

  async hydrate(
    scope: KnowledgeScope,
    vectorIds: string[],
    type?: string,
  ): Promise<IndexedSourceChunk[]> {
    return this.selectInChunks(vectorIds, (page) =>
      this.runQuery<IndexedSourceChunk>(
        `SELECT c.*, s.id AS source_id, s.kind, s.external_uri, s.updated_at, i.target, i.created_by_user_id
      ${CURRENT_INDEX_JOIN} AND c.vector_id IN (${page.map(() => "?").join(", ")})
      AND ${scope.projectId ? "s.project_id = ?" : "s.project_id IS NULL AND s.created_by_user_id = ?"}
      ${type ? "AND s.kind = ?" : ""}`,
        [...page, scope.projectId ?? scope.userId, ...(type ? [type] : [])],
      ),
    );
  }

  async listStatus(scope: KnowledgeScope): Promise<KnowledgeIndexStatus[]> {
    const rows = await this.runQuery<Omit<KnowledgeIndexStatus, "managed"> & { managed: number }>(
      `SELECT s.id AS sourceId, i.indexed_at AS indexedAt, (s.sync_id IS NOT NULL) AS managed,
      CASE WHEN s.status <> 'available' OR NOT ${sourceVisibilitySql("s")} THEN 'unavailable'
        WHEN s.kind = 'file' AND (s.mime_type LIKE 'image/%' OR s.mime_type LIKE 'audio/%' OR s.mime_type LIKE 'video/%') THEN 'unavailable'
        WHEN s.kind <> 'file' AND length(trim(COALESCE(s.content, ''))) = 0 THEN 'unavailable'
        WHEN i.lifecycle_status = 'active' THEN 'available' WHEN i.lifecycle_status = 'failed' THEN 'failed'
        WHEN t.status = 'failed' THEN 'failed'
        WHEN i.lifecycle_status = 'pending' THEN 'indexing' ELSE 'pending' END AS status
      FROM source s LEFT JOIN source_index i ON i.source_id = s.id AND i.revision = s.knowledge_revision
      LEFT JOIN tasks t ON t.id = 'source_index_' || s.id || '_' || s.knowledge_revision
      WHERE s.kind <> 'memory' AND ${sourceVisibilitySql("s")} AND ${scope.projectId ? "s.project_id = ?" : "s.project_id IS NULL AND s.created_by_user_id = ?"}
      ORDER BY s.created_at DESC`,
      [scope.projectId ?? scope.userId],
    );

    return rows.map((row) => ({ ...row, managed: row.managed === 1 }));
  }
}
