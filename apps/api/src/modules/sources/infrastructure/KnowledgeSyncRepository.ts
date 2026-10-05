import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";

export interface KnowledgeSyncRecord {
  id: string;
  created_by_user_id: number;
  project_id: string | null;
  repository: string;
  branch: string;
  path: string;
  installation_id: number;
  status: "idle" | "syncing" | "paused" | "blocked" | "failed";
  revision: number;
  checkpoint: string | null;
  lease_token: string | null;
  lease_expires_at: number | null;
  last_synced_at: string | null;
  last_commit: string | null;
  next_sync_at: number;
  error_message: string | null;
  document_count?: number;
}

export interface KnowledgeDocumentRecord {
  source_id: string;
  sync_id: string;
  path: string;
  blob_sha: string;
  commit_sha: string;
  seen_run_id: string;
  synced_at: string;
}

const managementAuthority = `(
  project_id IS NULL OR EXISTS (
    SELECT 1 FROM project p
    JOIN active_workspace_member m ON m.workspace_id = p.workspace_id
    JOIN user u ON u.id = m.user_id
    WHERE p.id = knowledge_sync.project_id AND m.user_id = knowledge_sync.created_by_user_id
      AND m.role IN ('owner', 'admin') AND u.plan_id = 'pro'
  )
)`;

const fence = `EXISTS (
  SELECT 1 FROM knowledge_sync WHERE id = ? AND revision = ? AND lease_token = ?
  AND lease_expires_at > (unixepoch() * 1000) AND status = 'syncing'
  AND ${managementAuthority}
)`;

export class KnowledgeSyncRepository extends BaseRepository {
  async get(id: string) {
    return this.runQuery<KnowledgeSyncRecord>(
      `SELECT k.*, (SELECT COUNT(*) FROM knowledge_sync_document WHERE sync_id = k.id) AS document_count
       FROM knowledge_sync k WHERE k.id = ?`,
      [id],
      true,
    );
  }

  async list(userId: number, projectId?: string) {
    return this.runQuery<KnowledgeSyncRecord>(
      `SELECT k.*, (SELECT COUNT(*) FROM knowledge_sync_document WHERE sync_id = k.id) AS document_count
       FROM knowledge_sync k WHERE ${projectId ? "k.project_id = ?" : "k.created_by_user_id = ? AND k.project_id IS NULL"}
       ORDER BY k.created_at DESC LIMIT 100`,
      [projectId ?? userId],
    );
  }

  async create(
    input: Omit<
      KnowledgeSyncRecord,
      | "checkpoint"
      | "lease_token"
      | "lease_expires_at"
      | "last_synced_at"
      | "last_commit"
      | "error_message"
      | "document_count"
    >,
  ) {
    const result = await this.runQuery<{ id: string }>(
      `INSERT INTO knowledge_sync
       (id, created_by_user_id, project_id, repository, branch, path, installation_id, status, revision, next_sync_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ? IS NULL OR EXISTS (
         SELECT 1 FROM project p JOIN active_workspace_member m ON m.workspace_id = p.workspace_id
         JOIN user u ON u.id = m.user_id
         WHERE p.id = ? AND m.user_id = ? AND m.role IN ('owner', 'admin') AND u.plan_id = 'pro'
       ) RETURNING id`,
      [
        input.id,
        input.created_by_user_id,
        input.project_id,
        input.repository,
        input.branch,
        input.path,
        input.installation_id,
        input.status,
        input.revision,
        input.next_sync_at,
        input.project_id,
        input.project_id,
        input.created_by_user_id,
      ],
      true,
    );

    this.requireChange(result);
  }

  async control(record: KnowledgeSyncRecord, actorId: number, action: "sync" | "pause" | "resume") {
    const result = await this.runQuery<{ id: string }>(
      `UPDATE knowledge_sync SET revision = revision + 1, status = ?, checkpoint = NULL,
       lease_token = NULL, lease_expires_at = NULL, next_sync_at = ?, error_message = NULL
       WHERE id = ? AND revision = ? AND created_by_user_id = ? AND ${managementAuthority} RETURNING id`,
      [action === "pause" ? "paused" : "idle", Date.now(), record.id, record.revision, actorId],
      true,
    );

    this.requireChange(result);
  }

  async remove(record: KnowledgeSyncRecord, actorId: number) {
    const result = await this.runQuery<{ id: string }>(
      `DELETE FROM knowledge_sync WHERE id = ? AND revision = ? AND created_by_user_id = ?
       AND ${managementAuthority} RETURNING id`,
      [record.id, record.revision, actorId],
      true,
    );

    this.requireChange(result);
  }

  async due() {
    return this.runQuery<{ id: string; created_by_user_id: number }>(
      `SELECT id, created_by_user_id FROM knowledge_sync
       WHERE status IN ('idle', 'syncing', 'failed') AND next_sync_at <= ?
       AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
       ORDER BY next_sync_at LIMIT 50`,
      [Date.now(), Date.now()],
    );
  }

  async claim(id: string, userId: number, token: string) {
    return this.runQuery<KnowledgeSyncRecord>(
      `UPDATE knowledge_sync SET status = 'syncing', lease_token = ?, lease_expires_at = ?
       WHERE id = ? AND created_by_user_id = ? AND status IN ('idle', 'syncing', 'failed')
       AND (lease_expires_at IS NULL OR lease_expires_at <= ?) AND ${managementAuthority}
       RETURNING *`,
      [token, Date.now() + 120_000, id, userId, Date.now()],
      true,
    );
  }

  async document(sourceId: string) {
    return this.runQuery<KnowledgeDocumentRecord>(
      "SELECT * FROM knowledge_sync_document WHERE source_id = ?",
      [sourceId],
      true,
    );
  }

  async findDocument(syncId: string, path: string) {
    return this.runQuery<KnowledgeDocumentRecord>(
      "SELECT * FROM knowledge_sync_document WHERE sync_id = ? AND path = ?",
      [syncId, path],
      true,
    );
  }

  async saveCheckpoint(record: KnowledgeSyncRecord, checkpoint: string) {
    const result = await this.runQuery<{ id: string }>(
      `UPDATE knowledge_sync SET checkpoint = ?, lease_expires_at = ?
       WHERE id = ? AND ${fence} RETURNING id`,
      [checkpoint, Date.now() + 120_000, record.id, record.id, record.revision, record.lease_token],
      true,
    );

    this.requireChange(result);
  }

  async saveDocument(
    record: KnowledgeSyncRecord,
    input: {
      path: string;
      sha: string;
      commit: string;
      runId: string;
      content: string;
      checkpoint: string;
    },
  ) {
    const existing = await this.findDocument(record.id, input.path);
    const sourceId = existing?.source_id ?? generateId();
    const bindings = [record.id, record.revision, record.lease_token];
    const syncedAt = new Date().toISOString();
    const citation = `https://github.com/${record.repository}/blob/${input.commit}/${input.path.split("/").map(encodeURIComponent).join("/")}`;
    const statements = [
      this.env.DB.prepare(
        `INSERT INTO source (id, created_by_user_id, project_id, kind, title, status, content, provider, external_uri, metadata)
         SELECT ?, ?, ?, 'repository', ?, 'available', ?, 'github-knowledge', ?, ? WHERE ${fence}
         ON CONFLICT(id) DO UPDATE SET content = excluded.content, external_uri = excluded.external_uri,
           metadata = excluded.metadata, status = 'available', updated_at = CURRENT_TIMESTAMP`,
      ).bind(
        sourceId,
        record.created_by_user_id,
        record.project_id,
        input.path.slice(0, 200),
        input.content,
        citation,
        JSON.stringify({
          syncId: record.id,
          path: input.path,
          blobSha: input.sha,
          commit: input.commit,
          syncedAt,
        }),
        ...bindings,
      ),
      this.env.DB.prepare(
        `INSERT INTO knowledge_sync_document (source_id, sync_id, path, blob_sha, commit_sha, seen_run_id, synced_at)
         SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${fence}
         ON CONFLICT(source_id) DO UPDATE SET blob_sha = excluded.blob_sha,
           commit_sha = excluded.commit_sha, seen_run_id = excluded.seen_run_id, synced_at = excluded.synced_at`,
      ).bind(
        sourceId,
        record.id,
        input.path,
        input.sha,
        input.commit,
        input.runId,
        syncedAt,
        ...bindings,
      ),
      this.env.DB.prepare(
        `UPDATE knowledge_sync SET checkpoint = ?, lease_expires_at = ? WHERE id = ? AND ${fence} RETURNING id`,
      ).bind(input.checkpoint, Date.now() + 120_000, record.id, ...bindings),
    ];
    const results = await this.executeBatch<{ id: string }>(statements);

    this.requireChange(results[2]?.results[0]);
  }

  async finish(record: KnowledgeSyncRecord, runId: string, commit: string) {
    const bindings = [record.id, record.revision, record.lease_token];
    const results = await this.executeBatch<{ id: string }>([
      this.env.DB.prepare(
        `DELETE FROM source WHERE id IN (
          SELECT source_id FROM knowledge_sync_document WHERE sync_id = ? AND seen_run_id != ?
        ) AND ${fence}`,
      ).bind(record.id, runId, ...bindings),
      this.env.DB.prepare(
        `UPDATE knowledge_sync SET checkpoint = NULL, last_commit = ?, last_synced_at = ?,
         status = 'idle', lease_token = NULL, lease_expires_at = NULL, error_message = NULL, next_sync_at = ?
         WHERE id = ? AND ${fence} RETURNING id`,
      ).bind(commit, new Date().toISOString(), Date.now() + 15 * 60_000, record.id, ...bindings),
    ]);

    this.requireChange(results[1]?.results[0]);
  }

  async release(
    record: KnowledgeSyncRecord,
    status: "syncing" | "failed" | "blocked",
    message: string | null = null,
  ) {
    await this.executeRun(
      `UPDATE knowledge_sync SET lease_token = NULL, lease_expires_at = NULL, status = ?,
       error_message = ?, next_sync_at = ? WHERE id = ? AND revision = ? AND lease_token = ?`,
      [
        status,
        message,
        Date.now() + (status === "syncing" ? 0 : 15 * 60_000),
        record.id,
        record.revision,
        record.lease_token,
      ],
    );
  }

  async search(userId: number, projectId: string | undefined, query: string) {
    return this.runQuery<
      KnowledgeDocumentRecord & { title: string; content: string; external_uri: string }
    >(
      `SELECT d.*, s.title, s.content, s.external_uri FROM knowledge_sync_document d
       JOIN source s ON s.id = d.source_id JOIN knowledge_sync k ON k.id = d.sync_id
       WHERE s.status = 'available' AND k.status IN ('idle', 'syncing')
         AND ${projectId ? "s.project_id = ?" : "s.project_id IS NULL AND s.created_by_user_id = ?"}
         AND (instr(lower(s.title), lower(?)) > 0 OR instr(lower(s.content), lower(?)) > 0)
       ORDER BY instr(lower(s.title), lower(?)) > 0 DESC, d.synced_at DESC LIMIT 15`,
      [projectId ?? userId, query, query, query],
    );
  }

  private requireChange(result: { id: string } | null | undefined) {
    if (!result) {
      throw new AssistantError(
        "Knowledge connection changed or access expired",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }
  }
}
