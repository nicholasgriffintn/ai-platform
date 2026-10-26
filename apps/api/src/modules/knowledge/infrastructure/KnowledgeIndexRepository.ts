import { paginate } from "@ngriffin_uk/polychat-utility-server/arrays";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { PendingEmbeddingDocument } from "~/modules/knowledge/application/index/chunks";
import { sourceVisibilitySql } from "~/modules/sources/infrastructure/source-visibility";
import type { EmbeddingRuntimeTarget, IEnv } from "~/types";

export type IndexedResourceType = "source" | "output";

export interface KnowledgeFilters {
  kinds?: readonly string[];
  resourceTypes?: readonly IndexedResourceType[];
  origins?: readonly string[];
  providers?: readonly string[];
  collectionIds?: readonly string[];
  syncIds?: readonly string[];
  since?: string;
  until?: string;
  excludeConfidential?: boolean;
}

export interface KnowledgeScope {
  userId: number;
  projectId?: string;
  sourceIds?: readonly string[];
  filters?: KnowledgeFilters;
}

export interface IndexableResource {
  resource_type: IndexedResourceType;
  id: string;
  created_by_user_id: number;
  project_id: string | null;
  connection_id: string | null;
  kind: string;
  title: string;
  status: string;
  content: string | null;
  provider: string | null;
  external_uri: string | null;
  metadata: string;
  updated_at: string | null;
  search_revision: number;
  sensitivity: string | null;
  mime_type: string | null;
}

export interface KnowledgeIndexDocument {
  id: string;
  resource_type: IndexedResourceType;
  source_id: string;
  source_revision: number;
  user_id: number;
  project_id: string | null;
  status: "lexical" | "active" | "stale";
  target: string;
  lease_token: string | null;
  lease_expires_at: string | null;
}

export interface KnowledgePassage {
  id: string;
  resourceType: IndexedResourceType;
  sourceId: string;
  sourceRevision: number;
  chunkIndex: number;
  title: string;
  content: string;
  type: string;
  origin: string | null;
  provider: string | null;
  externalUri: string | null;
  updatedAt: string | null;
  upstreamRevision: string | number | null;
  lastSyncedAt: string | null;
  target: string;
  userId: number;
  retrieval: "included" | "excluded";
  sensitivity: string;
}

export interface KnowledgeIndexCandidate {
  id: string;
  resource_type: IndexedResourceType;
  user_id: number | null;
  project_id: string | null;
}

export const INDEXED_OUTPUT_KINDS = ["document", "deck", "sheet"] as const;

const CHUNKS_PER_STATEMENT = 50;

const knowledgeResourceSql = `(SELECT 'source' AS resource_type, id, created_by_user_id, project_id, connection_id, kind,
    title, status, content, provider, external_uri, metadata, updated_at, search_revision, sensitivity, mime_type
  FROM resource WHERE resource_type = 'source'
  UNION ALL
  SELECT 'output', id, created_by_user_id, project_id, NULL, kind, title,
    CASE WHEN status = 'ready' AND deleted_at IS NULL THEN 'available' ELSE 'archived' END,
    content, NULL, NULL, '{}', updated_at, search_revision, sensitivity, mime_type
  FROM resource WHERE resource_type = 'output')`;

const PASSAGE_COLUMNS = `c.id, s.resource_type AS resourceType, s.id AS sourceId, d.source_revision AS sourceRevision,
  c.chunk_index AS chunkIndex, s.title, c.content, s.kind AS type, s.provider, s.external_uri AS externalUri,
  s.updated_at AS updatedAt, d.target, d.user_id AS userId,
  CASE WHEN json_extract(s.metadata, '$.retrieval') = 'excluded' THEN 'excluded' ELSE 'included' END AS retrieval,
  COALESCE(s.sensitivity, '') AS sensitivity,
  CASE WHEN json_type(s.metadata, '$.origin') = 'text' THEN json_extract(s.metadata, '$.origin') ELSE NULL END AS origin,
  CASE WHEN json_type(s.metadata, '$.upstream.revision') IN ('integer', 'real', 'text') THEN json_extract(s.metadata, '$.upstream.revision') ELSE NULL END AS upstreamRevision,
  CASE WHEN json_type(s.metadata, '$.upstream.syncedAt') = 'text' THEN json_extract(s.metadata, '$.upstream.syncedAt') ELSE NULL END AS lastSyncedAt`;

const CURRENT_RESOURCE = `d.document_type = 'source' AND s.resource_type = d.resource_type AND s.id = d.source_id
  AND s.search_revision = d.source_revision AND s.status = 'available' AND s.kind != 'memory' AND ${sourceVisibilitySql("s")}`;

const RETRIEVABLE = `json_extract(s.metadata, '$.retrieval') IS NOT 'excluded'`;

function jsonList(values: readonly unknown[]): string {
  return JSON.stringify(values);
}

function scopeFilter(scope: KnowledgeScope): { sql: string; values: unknown[] } {
  const clauses = [
    scope.projectId ? "s.project_id = ?" : "s.project_id IS NULL AND s.created_by_user_id = ?",
  ];
  const values: unknown[] = [scope.projectId ?? scope.userId];
  const filters = scope.filters ?? {};

  if (scope.sourceIds) {
    clauses.push("s.id IN (SELECT value FROM json_each(?))");
    values.push(jsonList(scope.sourceIds));
  }

  if (filters.kinds?.length) {
    clauses.push("s.kind IN (SELECT value FROM json_each(?))");
    values.push(jsonList(filters.kinds));
  }

  if (filters.resourceTypes?.length) {
    clauses.push("s.resource_type IN (SELECT value FROM json_each(?))");
    values.push(jsonList(filters.resourceTypes));
  }

  if (filters.origins?.length) {
    clauses.push("json_extract(s.metadata, '$.origin') IN (SELECT value FROM json_each(?))");
    values.push(jsonList(filters.origins));
  }

  if (filters.providers?.length) {
    clauses.push("s.provider IN (SELECT value FROM json_each(?))");
    values.push(jsonList(filters.providers));
  }

  if (filters.collectionIds?.length) {
    clauses.push(`EXISTS (SELECT 1 FROM resource_link l WHERE l.collection_id IN (SELECT value FROM json_each(?))
      AND ((s.resource_type = 'source' AND l.kind = 'source_collection' AND l.source_id = s.id)
        OR (s.resource_type = 'output' AND l.kind = 'output_collection' AND l.output_id = s.id)))`);
    values.push(jsonList(filters.collectionIds));
  }

  if (filters.syncIds?.length) {
    clauses.push(`(json_extract(s.metadata, '$.syncId') IN (SELECT value FROM json_each(?))
      OR json_extract(s.metadata, '$.knowledgeFeed.syncId') IN (SELECT value FROM json_each(?)))`);
    values.push(jsonList(filters.syncIds), jsonList(filters.syncIds));
  }

  if (filters.since) {
    clauses.push("s.updated_at >= datetime(?)");
    values.push(filters.since);
  }

  if (filters.until) {
    clauses.push("s.updated_at <= datetime(?)");
    values.push(filters.until);
  }

  if (filters.excludeConfidential) {
    clauses.push("s.sensitivity IS NOT 'confidential'");
  }

  return { sql: clauses.join(" AND "), values };
}

export class KnowledgeIndexRepository extends BaseRepository<Pick<IEnv, "DB">> {
  getResource(resourceType: IndexedResourceType, id: string): Promise<IndexableResource | null> {
    return this.runQuery<IndexableResource>(
      `SELECT * FROM ${knowledgeResourceSql} s WHERE s.resource_type = ? AND s.id = ?`,
      [resourceType, id],
      true,
    );
  }

  getDocument(
    resourceType: IndexedResourceType,
    sourceId: string,
    revision: number,
  ): Promise<KnowledgeIndexDocument | null> {
    return this.runQuery<KnowledgeIndexDocument>(
      `SELECT * FROM search_document WHERE document_type = 'source' AND resource_type = ?
         AND source_id = ? AND source_revision = ?`,
      [resourceType, sourceId, revision],
      true,
    );
  }

  latestDocument(
    resourceType: IndexedResourceType,
    sourceId: string,
  ): Promise<KnowledgeIndexDocument | null> {
    return this.runQuery<KnowledgeIndexDocument>(
      `SELECT * FROM search_document WHERE document_type = 'source' AND resource_type = ? AND source_id = ?
       ORDER BY source_revision DESC LIMIT 1`,
      [resourceType, sourceId],
      true,
    );
  }

  async prepare(
    resource: IndexableResource,
    document: PendingEmbeddingDocument,
    target: EmbeddingRuntimeTarget,
    userId: number,
  ): Promise<void> {
    const guard = `EXISTS (SELECT 1 FROM ${knowledgeResourceSql} s WHERE s.resource_type = ? AND s.id = ?
      AND s.search_revision = ? AND s.status = 'available' AND ${sourceVisibilitySql("s")})`;
    const guardValues = [resource.resource_type, resource.id, resource.search_revision];

    await this.env.DB.prepare(
      `INSERT INTO search_document
         (document_type, resource_type, id, source_id, source_revision, user_id, project_id, target)
       SELECT 'source', ?, ?, ?, ?, ?, ?, ? WHERE ${guard}
       ON CONFLICT(resource_type, source_id, source_revision) WHERE document_type = 'source' DO NOTHING`,
    )
      .bind(
        resource.resource_type,
        document.documentId,
        resource.id,
        resource.search_revision,
        userId,
        resource.project_id,
        JSON.stringify(target),
        ...guardValues,
      )
      .run();

    for (const chunks of paginate(document.chunks, CHUNKS_PER_STATEMENT)) {
      await this.env.DB.prepare(
        `INSERT INTO search_chunk (document_type, id, document_id, chunk_index, title, content, metadata)
         SELECT 'source', json_extract(value, '$.vectorId'), ?, json_extract(value, '$.index'), ?,
                json_extract(value, '$.content'), json_extract(value, '$.metadata')
         FROM json_each(?)
         WHERE ${guard}
           AND EXISTS (SELECT 1 FROM search_document WHERE document_type = 'source' AND id = ? AND status != 'stale')
         ON CONFLICT(document_type, id) DO NOTHING`,
      )
        .bind(
          document.documentId,
          resource.title,
          JSON.stringify(
            chunks.map((chunk) => ({
              ...chunk,
              metadata: chunk.metadata ? JSON.stringify(chunk.metadata) : null,
            })),
          ),
          ...guardValues,
          document.documentId,
        )
        .run();
    }
  }

  async claim(documentId: string, token: string, status: "lexical" | "stale"): Promise<boolean> {
    const result = await this.executeRun(
      `UPDATE search_document SET lease_token = ?, lease_expires_at = datetime('now', '+10 minutes')
       WHERE document_type = 'source' AND id = ? AND status = ? AND (lease_token IS NULL OR lease_expires_at < CURRENT_TIMESTAMP)`,
      [token, documentId, status],
    );

    return result.meta.changes === 1;
  }

  async release(documentId: string, token: string): Promise<void> {
    await this.executeRun(
      "UPDATE search_document SET lease_token = NULL, lease_expires_at = NULL WHERE document_type = 'source' AND id = ? AND lease_token = ?",
      [documentId, token],
    );
  }

  async renew(documentId: string, token: string): Promise<boolean> {
    const result = await this.executeRun(
      `UPDATE search_document AS d SET lease_expires_at = datetime('now', '+10 minutes')
       WHERE document_type = 'source' AND id = ? AND status = 'lexical' AND lease_token = ? AND lease_expires_at >= CURRENT_TIMESTAMP
         AND EXISTS (SELECT 1 FROM ${knowledgeResourceSql} s WHERE ${CURRENT_RESOURCE})`,
      [documentId, token],
    );

    return result.meta.changes === 1;
  }

  async activate(documentId: string, token: string): Promise<boolean> {
    const result = await this.executeRun(
      `UPDATE search_document AS d SET status = 'active'
       WHERE document_type = 'source' AND id = ? AND status = 'lexical' AND lease_token = ? AND lease_expires_at >= CURRENT_TIMESTAMP
         AND NOT EXISTS (SELECT 1 FROM search_chunk c WHERE c.document_type = 'source' AND c.document_id = d.id
           AND c.lifecycle_status IS NOT 'active')
         AND EXISTS (SELECT 1 FROM ${knowledgeResourceSql} s WHERE ${CURRENT_RESOURCE})`,
      [documentId, token],
    );

    return result.meta.changes === 1;
  }

  pendingChunks(
    documentId: string,
  ): Promise<{ id: string; content: string; chunk_index: number }[]> {
    return this.runQuery(
      `SELECT id, content, chunk_index FROM search_chunk
       WHERE document_type = 'source' AND document_id = ? AND lifecycle_status IS NOT 'active'
       ORDER BY chunk_index`,
      [documentId],
    );
  }

  async markChunksEmbedded(documentId: string, ids: readonly string[]): Promise<void> {
    await this.executeRun(
      `UPDATE search_chunk SET lifecycle_status = 'active'
       WHERE document_type = 'source' AND document_id = ? AND id IN (SELECT value FROM json_each(?))`,
      [documentId, jsonList(ids)],
    );
  }

  lexical(scope: KnowledgeScope, query: string): Promise<KnowledgePassage[]> {
    const filter = scopeFilter(scope);

    return this.runQuery<KnowledgePassage>(
      `SELECT ${PASSAGE_COLUMNS}
       FROM search_fts
       JOIN search_chunk c ON c.rowid = search_fts.rowid
       JOIN search_document d ON d.document_type = c.document_type AND d.id = c.document_id
       JOIN ${knowledgeResourceSql} s ON ${CURRENT_RESOURCE}
       WHERE search_fts MATCH ? AND ${filter.sql} AND ${RETRIEVABLE}
         AND d.status IN ('lexical', 'active')
       ORDER BY bm25(search_fts, 3.0, 1.0), c.id LIMIT 30`,
      [query, ...filter.values],
    );
  }

  hydrate(
    scope: KnowledgeScope,
    vectorIds: string[],
    activeOnly = false,
  ): Promise<KnowledgePassage[]> {
    const filter = scopeFilter(scope);

    return this.runQuery<KnowledgePassage>(
      `SELECT ${PASSAGE_COLUMNS}
       FROM search_chunk c
       JOIN search_document d ON d.document_type = c.document_type AND d.id = c.document_id AND ${activeOnly ? "d.status = 'active'" : "d.status IN ('lexical', 'active')"}
       JOIN ${knowledgeResourceSql} s ON ${CURRENT_RESOURCE}
       WHERE ${filter.sql} AND ${RETRIEVABLE} AND c.id IN (SELECT value FROM json_each(?))`,
      [...filter.values, jsonList(vectorIds)],
    );
  }

  getTargets(scope: KnowledgeScope): Promise<{ target: string; userId: number }[]> {
    const filter = scopeFilter({ userId: scope.userId, projectId: scope.projectId });

    return this.runQuery<{ target: string; userId: number }>(
      `SELECT DISTINCT d.target, d.user_id AS userId FROM search_document d
       JOIN ${knowledgeResourceSql} s ON ${CURRENT_RESOURCE}
       WHERE ${filter.sql} AND d.status = 'active' LIMIT 9`,
      filter.values,
    );
  }

  stale(resourceType: IndexedResourceType, sourceId: string): Promise<KnowledgeIndexDocument[]> {
    return this.runQuery<KnowledgeIndexDocument>(
      `SELECT * FROM search_document WHERE document_type = 'source' AND resource_type = ?
         AND source_id = ? AND status = 'stale'`,
      [resourceType, sourceId],
    );
  }

  chunks(documentId: string): Promise<{ id: string; content: string; chunk_index: number }[]> {
    return this.runQuery(
      "SELECT id, content, chunk_index FROM search_chunk WHERE document_type = 'source' AND document_id = ? ORDER BY chunk_index",
      [documentId],
    );
  }

  async removeStale(documentId: string, token: string): Promise<void> {
    await this.executeRun(
      "DELETE FROM search_document WHERE document_type = 'source' AND id = ? AND status = 'stale' AND lease_token = ?",
      [documentId, token],
    );
  }

  maintenance(
    includeSemantic: boolean,
    includeCleanup: boolean,
  ): Promise<KnowledgeIndexCandidate[]> {
    return this.runQuery(
      `WITH candidates AS (
         SELECT s.resource_type, s.id, s.created_by_user_id AS user_id, s.project_id FROM ${knowledgeResourceSql} s
         LEFT JOIN search_document d ON d.document_type = 'source' AND d.resource_type = s.resource_type
           AND d.source_id = s.id AND d.source_revision = s.search_revision
         WHERE s.kind != 'memory' AND s.status = 'available' AND ${sourceVisibilitySql("s")}
           AND (s.resource_type = 'source' OR s.kind IN (SELECT value FROM json_each(?)))
           AND length(trim(COALESCE(s.content, ''))) > 0 AND (d.id IS NULL OR (? = 1 AND d.status = 'lexical'))
         UNION SELECT resource_type, source_id AS id, user_id, project_id FROM search_document
           WHERE document_type = 'source' AND status = 'stale' AND ? = 1)
       SELECT c.resource_type, c.id, (SELECT id FROM project WHERE id = c.project_id) AS project_id,
         COALESCE(
           (SELECT wm.user_id FROM resource_grant wm JOIN project p ON wm.kind = 'membership' AND p.workspace_id = wm.workspace_id
            WHERE p.id = c.project_id AND wm.user_id = c.user_id LIMIT 1),
           (SELECT wm.user_id FROM resource_grant wm JOIN project p ON wm.kind = 'membership' AND p.workspace_id = wm.workspace_id
            WHERE p.id = c.project_id ORDER BY CASE WHEN wm.role = 'owner' THEN 1
              WHEN wm.role = 'admin' THEN 2 ELSE 3 END LIMIT 1),
           (SELECT id FROM user WHERE id = c.user_id)
         ) AS user_id
       FROM candidates c
       WHERE NOT EXISTS (SELECT 1 FROM search_document leased WHERE leased.document_type = 'source'
           AND leased.resource_type = c.resource_type AND leased.source_id = c.id AND leased.lease_expires_at >= CURRENT_TIMESTAMP)
       AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.task_type = 'source_knowledge_index'
         AND (t.status IN ('pending', 'queued', 'running') OR t.execution_lease_expires_at >= datetime('now', '-1 minute'))
         AND json_extract(t.task_data, '$.sourceId') = c.id)
       LIMIT 100`,
      [jsonList(INDEXED_OUTPUT_KINDS), includeSemantic ? 1 : 0, includeCleanup ? 1 : 0],
    );
  }
}
