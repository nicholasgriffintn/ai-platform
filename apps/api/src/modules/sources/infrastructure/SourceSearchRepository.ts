import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { PendingEmbeddingDocument } from "~/modules/apps/application/embeddings/document";
import type { EmbeddingRuntimeTarget, IEnv } from "~/types";

import { sourceVisibilitySql } from "./source-visibility";
import type { SourceRecord } from "./SourceRepository";

export interface KnowledgeScope {
  userId: number;
  projectId?: string;
}

export interface SearchableSource extends SourceRecord {
  search_revision: number;
}

export interface SourceSearchDocument {
  id: string;
  source_id: string;
  source_revision: number;
  user_id: number;
  project_id: string | null;
  status: "lexical" | "active" | "stale";
  target: string;
  lease_token: string | null;
  lease_expires_at: string | null;
}

export interface SourceSearchPassage {
  id: string;
  sourceId: string;
  sourceRevision: number;
  chunkIndex: number;
  title: string;
  content: string;
  type: string;
  externalUri: string | null;
  updatedAt: string | null;
  upstreamRevision: string | number | null;
  lastSyncedAt: string | null;
  target: string;
  userId: number;
}

const PASSAGE_COLUMNS = `c.id, s.id AS sourceId, d.source_revision AS sourceRevision,
  c.chunk_index AS chunkIndex, s.title, c.content, s.kind AS type,
  s.external_uri AS externalUri, s.updated_at AS updatedAt, d.target, d.user_id AS userId,
  CASE WHEN json_type(s.metadata, '$.upstreamRevision') IN ('integer', 'text') THEN json_extract(s.metadata, '$.upstreamRevision') ELSE NULL END AS upstreamRevision,
  CASE WHEN json_type(s.metadata, '$.lastSyncedAt') = 'text' THEN json_extract(s.metadata, '$.lastSyncedAt') ELSE NULL END AS lastSyncedAt`;
const CURRENT_SOURCE = `s.id = d.source_id AND s.search_revision = d.source_revision
  AND s.status = 'available' AND s.kind != 'memory' AND ${sourceVisibilitySql("s")} AND (s.provider IS NULL OR s.provider != 'github-knowledge')`;

export class SourceSearchRepository extends BaseRepository<Pick<IEnv, "DB">> {
  getSource(sourceId: string): Promise<SearchableSource | null> {
    return this.runQuery<SearchableSource>(
      "SELECT * FROM source WHERE id = ? AND (provider IS NULL OR provider != 'github-knowledge')",
      [sourceId],
      true,
    );
  }

  getDocument(sourceId: string, revision: number): Promise<SourceSearchDocument | null> {
    return this.runQuery<SourceSearchDocument>(
      "SELECT * FROM source_search_document WHERE source_id = ? AND source_revision = ?",
      [sourceId, revision],
      true,
    );
  }

  async prepare(
    source: SearchableSource,
    document: PendingEmbeddingDocument,
    target: EmbeddingRuntimeTarget,
    userId: number,
  ): Promise<void> {
    const guard = `EXISTS (SELECT 1 FROM source s WHERE id = ? AND search_revision = ?
      AND status = 'available' AND ${sourceVisibilitySql("s")} AND (s.provider IS NULL OR s.provider != 'github-knowledge'))`;

    await this.env.DB.batch([
      this.env.DB.prepare(
        `INSERT INTO source_search_document
           (id, source_id, source_revision, user_id, project_id, target)
         SELECT ?, ?, ?, ?, ?, ? WHERE ${guard}
         ON CONFLICT(source_id, source_revision) DO NOTHING`,
      ).bind(
        document.documentId,
        source.id,
        source.search_revision,
        userId,
        source.project_id,
        JSON.stringify(target),
        source.id,
        source.search_revision,
      ),
      this.env.DB.prepare(
        `INSERT INTO source_search_chunk (id, document_id, chunk_index, title, content)
         SELECT json_extract(value, '$.vectorId'), ?, json_extract(value, '$.index'), ?,
                json_extract(value, '$.content')
         FROM json_each(?)
         WHERE ${guard}
           AND EXISTS (SELECT 1 FROM source_search_document WHERE id = ? AND status != 'stale')
         ON CONFLICT(id) DO NOTHING`,
      ).bind(
        document.documentId,
        source.title,
        JSON.stringify(document.chunks),
        source.id,
        source.search_revision,
        document.documentId,
      ),
    ]);
  }

  async claim(documentId: string, token: string, status: "lexical" | "stale"): Promise<boolean> {
    const result = await this.executeRun(
      `UPDATE source_search_document SET lease_token = ?, lease_expires_at = datetime('now', '+10 minutes')
       WHERE id = ? AND status = ? AND (lease_token IS NULL OR lease_expires_at < CURRENT_TIMESTAMP)`,
      [token, documentId, status],
    );

    return result.meta.changes === 1;
  }

  async release(documentId: string, token: string): Promise<void> {
    await this.executeRun(
      "UPDATE source_search_document SET lease_token = NULL, lease_expires_at = NULL WHERE id = ? AND lease_token = ?",
      [documentId, token],
    );
  }

  async renew(documentId: string, token: string): Promise<boolean> {
    const result = await this.executeRun(
      `UPDATE source_search_document AS d SET lease_expires_at = datetime('now', '+10 minutes')
       WHERE id = ? AND status = 'lexical' AND lease_token = ? AND lease_expires_at >= CURRENT_TIMESTAMP
         AND EXISTS (SELECT 1 FROM source s WHERE ${CURRENT_SOURCE})`,
      [documentId, token],
    );

    return result.meta.changes === 1;
  }

  async activate(documentId: string, token: string): Promise<boolean> {
    const result = await this.executeRun(
      `UPDATE source_search_document AS d SET status = 'active'
       WHERE id = ? AND status = 'lexical' AND lease_token = ? AND lease_expires_at >= CURRENT_TIMESTAMP
         AND EXISTS (SELECT 1 FROM source s WHERE ${CURRENT_SOURCE})`,
      [documentId, token],
    );

    return result.meta.changes === 1;
  }

  lexical(scope: KnowledgeScope, query: string, type?: string): Promise<SourceSearchPassage[]> {
    return this.runQuery<SourceSearchPassage>(
      `SELECT ${PASSAGE_COLUMNS}
       FROM source_search_fts
       JOIN source_search_chunk c ON c.rowid = source_search_fts.rowid
       JOIN source_search_document d ON d.id = c.document_id
       JOIN source s ON ${CURRENT_SOURCE}
       WHERE source_search_fts MATCH ? AND ${scope.projectId ? "s.project_id = ?" : "s.project_id IS NULL AND s.created_by_user_id = ?"}
         AND d.status IN ('lexical', 'active') AND (? IS NULL OR s.kind = ?)
       ORDER BY bm25(source_search_fts, 3.0, 1.0), c.id LIMIT 30`,
      [query, scope.projectId ?? scope.userId, type ?? null, type ?? null],
    );
  }

  hydrate(
    scope: KnowledgeScope,
    vectorIds: string[],
    type?: string,
    activeOnly = false,
  ): Promise<SourceSearchPassage[]> {
    return this.runQuery<SourceSearchPassage>(
      `SELECT ${PASSAGE_COLUMNS}
       FROM source_search_chunk c
       JOIN source_search_document d ON d.id = c.document_id AND ${activeOnly ? "d.status = 'active'" : "d.status IN ('lexical', 'active')"}
       JOIN source s ON ${CURRENT_SOURCE}
       WHERE ${scope.projectId ? "s.project_id = ?" : "s.project_id IS NULL AND s.created_by_user_id = ?"} AND c.id IN (SELECT value FROM json_each(?))
         AND (? IS NULL OR s.kind = ?)`,
      [scope.projectId ?? scope.userId, JSON.stringify(vectorIds), type ?? null, type ?? null],
    );
  }

  getTargets(scope: KnowledgeScope): Promise<{ target: string; userId: number }[]> {
    return this.runQuery<{ target: string; userId: number }>(
      `SELECT DISTINCT d.target, d.user_id AS userId FROM source_search_document d
       JOIN source s ON ${CURRENT_SOURCE}
       WHERE ${scope.projectId ? "s.project_id = ?" : "s.project_id IS NULL AND s.created_by_user_id = ?"} AND d.status = 'active' LIMIT 9`,
      [scope.projectId ?? scope.userId],
    );
  }

  stale(sourceId: string): Promise<SourceSearchDocument[]> {
    return this.runQuery<SourceSearchDocument>(
      "SELECT * FROM source_search_document WHERE source_id = ? AND status = 'stale'",
      [sourceId],
    );
  }

  chunks(documentId: string): Promise<{ id: string; content: string; chunk_index: number }[]> {
    return this.runQuery(
      "SELECT id, content, chunk_index FROM source_search_chunk WHERE document_id = ? ORDER BY chunk_index",
      [documentId],
    );
  }

  async removeStale(documentId: string, token: string): Promise<void> {
    await this.executeRun(
      "DELETE FROM source_search_document WHERE id = ? AND status = 'stale' AND lease_token = ?",
      [documentId, token],
    );
  }

  maintenance(
    includeSemantic: boolean,
    includeCleanup: boolean,
  ): Promise<{ id: string; user_id: number | null; project_id: string | null }[]> {
    return this.runQuery(
      `WITH candidates AS (SELECT s.id, s.created_by_user_id AS user_id, s.project_id FROM source s
       LEFT JOIN source_search_document d ON d.source_id = s.id AND d.source_revision = s.search_revision
       WHERE s.kind != 'memory' AND s.status = 'available' AND ${sourceVisibilitySql("s")} AND (s.provider IS NULL OR s.provider != 'github-knowledge')
         AND length(trim(s.content)) > 0 AND (d.id IS NULL OR (? = 1 AND d.status = 'lexical'))
       UNION SELECT source_id AS id, user_id, project_id FROM source_search_document WHERE status = 'stale' AND ? = 1)
       SELECT c.id, (SELECT id FROM project WHERE id = c.project_id) AS project_id,
         COALESCE(
           (SELECT wm.user_id FROM active_workspace_member wm JOIN project p ON p.workspace_id = wm.workspace_id
            WHERE p.id = c.project_id AND wm.user_id = c.user_id LIMIT 1),
           (SELECT wm.user_id FROM active_workspace_member wm JOIN project p ON p.workspace_id = wm.workspace_id
            WHERE p.id = c.project_id ORDER BY CASE WHEN wm.role = 'owner' THEN 1
              WHEN wm.role = 'admin' THEN 2 ELSE 3 END LIMIT 1),
           (SELECT id FROM user WHERE id = c.user_id)
         ) AS user_id
       FROM candidates c
       WHERE NOT EXISTS (SELECT 1 FROM source_search_document leased WHERE leased.source_id = c.id AND leased.lease_expires_at >= CURRENT_TIMESTAMP)
       AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.task_type = 'source_knowledge_index'
         AND (t.status IN ('pending', 'queued', 'running') OR t.execution_lease_expires_at >= datetime('now', '-1 minute'))
         AND json_extract(t.task_data, '$.sourceId') = c.id)
       LIMIT 100`,
      [includeSemantic ? 1 : 0, includeCleanup ? 1 : 0],
    );
  }
}
