import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { PendingEmbeddingDocument } from "~/modules/apps/application/embeddings/document";
import type { EmbeddingRuntimeTarget, IEnv } from "~/types";

import type { SourceRecord } from "./SourceRepository";

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
}

const PASSAGE_COLUMNS = `c.id, s.id AS sourceId, d.source_revision AS sourceRevision,
  c.chunk_index AS chunkIndex, s.title, c.content, s.kind AS type,
  s.external_uri AS externalUri, s.updated_at AS updatedAt, d.target,
  CASE WHEN json_type(s.metadata, '$.upstreamRevision') IN ('integer', 'text') THEN json_extract(s.metadata, '$.upstreamRevision') ELSE NULL END AS upstreamRevision,
  CASE WHEN json_type(s.metadata, '$.lastSyncedAt') = 'text' THEN json_extract(s.metadata, '$.lastSyncedAt') ELSE NULL END AS lastSyncedAt`;
const CURRENT_SOURCE = `s.id = d.source_id AND s.search_revision = d.source_revision
  AND s.status = 'available' AND s.kind != 'memory'`;

export class SourceSearchRepository extends BaseRepository<Pick<IEnv, "DB">> {
  getSource(sourceId: string): Promise<SearchableSource | null> {
    return this.runQuery<SearchableSource>("SELECT * FROM source WHERE id = ?", [sourceId], true);
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
  ): Promise<void> {
    const guard =
      "EXISTS (SELECT 1 FROM source WHERE id = ? AND search_revision = ? AND status = 'available')";

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
        source.created_by_user_id,
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

  lexical(projectId: string, query: string, type?: string): Promise<SourceSearchPassage[]> {
    return this.runQuery<SourceSearchPassage>(
      `SELECT ${PASSAGE_COLUMNS}
       FROM source_search_fts
       JOIN source_search_chunk c ON c.rowid = source_search_fts.rowid
       JOIN source_search_document d ON d.id = c.document_id
       JOIN source s ON ${CURRENT_SOURCE}
       WHERE source_search_fts MATCH ? AND s.project_id = ?
         AND d.status IN ('lexical', 'active') AND (? IS NULL OR s.kind = ?)
       ORDER BY bm25(source_search_fts, 3.0, 1.0), c.id LIMIT 30`,
      [query, projectId, type ?? null, type ?? null],
    );
  }

  hydrate(projectId: string, vectorIds: string[], type?: string): Promise<SourceSearchPassage[]> {
    return this.runQuery<SourceSearchPassage>(
      `SELECT ${PASSAGE_COLUMNS}
       FROM source_search_chunk c
       JOIN source_search_document d ON d.id = c.document_id AND d.status = 'active'
       JOIN source s ON ${CURRENT_SOURCE}
       WHERE s.project_id = ? AND c.id IN (SELECT value FROM json_each(?))
         AND (? IS NULL OR s.kind = ?)`,
      [projectId, JSON.stringify(vectorIds), type ?? null, type ?? null],
    );
  }

  getTargets(projectId: string): Promise<{ target: string }[]> {
    return this.runQuery<{ target: string }>(
      `SELECT DISTINCT d.target FROM source_search_document d
       JOIN source s ON ${CURRENT_SOURCE}
       WHERE s.project_id = ? AND d.status = 'active' LIMIT 9`,
      [projectId],
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

  removeStale(documentId: string, token: string): Promise<D1Result> {
    return this.executeRun(
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
       WHERE s.project_id IS NOT NULL AND s.kind != 'memory' AND s.status = 'available'
         AND length(trim(s.content)) > 0 AND (d.id IS NULL OR (? = 1 AND d.status = 'lexical'))
       UNION SELECT source_id AS id, user_id, project_id FROM source_search_document WHERE status = 'stale' AND ? = 1)
       SELECT c.id, (SELECT id FROM project WHERE id = c.project_id) AS project_id,
         COALESCE(
           (SELECT wm.user_id FROM workspace_member wm JOIN project p ON p.workspace_id = wm.workspace_id
            WHERE p.id = c.project_id AND wm.user_id = c.user_id LIMIT 1),
           (SELECT wm.user_id FROM workspace_member wm JOIN project p ON p.workspace_id = wm.workspace_id
            WHERE p.id = c.project_id ORDER BY CASE WHEN wm.role = 'owner' THEN 1
              WHEN wm.role = 'admin' THEN 2 ELSE 3 END LIMIT 1),
           (SELECT id FROM user WHERE id = c.user_id)
         ) AS user_id
       FROM candidates c
       WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.task_type = 'source_knowledge_index'
         AND t.status IN ('pending', 'queued', 'running')
         AND json_extract(t.task_data, '$.sourceId') = c.id)
       LIMIT 100`,
      [includeSemantic ? 1 : 0, includeCleanup ? 1 : 0],
    );
  }
}
