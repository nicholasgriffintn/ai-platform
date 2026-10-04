import type {
  CreateSourceSyncInput,
  KnowledgeDocumentPermissions,
  SourceSync,
  SourceSyncCheckpoint,
  RecipeConnectorProvider,
} from "@ngriffin_uk/polychat-schemas";
import { generatePrefixedId } from "@ngriffin_uk/polychat-utility-core";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";

import { sourceVisibilitySql } from "./source-visibility";

export interface SourceSyncRecord {
  id: string;
  created_by_user_id: number;
  project_id: string | null;
  connection_id: string;
  provider: RecipeConnectorProvider;
  root_id: string;
  title: string;
  enabled: number;
  status: SourceSync["status"];
  checkpoint: string;
  run_id: string | null;
  page: number;
  last_synced_at: string | null;
  next_sync_at: string | null;
  last_error: string | null;
}

export interface SyncedSourceRecord {
  id: string;
  upstream_version: string | null;
  content: string | null;
  status: string;
}

export class SourceSyncRepository extends BaseRepository {
  async create(
    userId: number,
    input: CreateSourceSyncInput,
    connectionId: string,
  ): Promise<SourceSyncRecord> {
    const id = generatePrefixedId("sourcesync_");

    await this.executeRun(
      `INSERT INTO source_sync (id, created_by_user_id, project_id, connection_id, provider, root_id, title)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        input.projectId ?? null,
        connectionId,
        input.provider,
        input.rootId,
        input.title,
      ],
    );
    const record = await this.get(id);

    if (!record) {
      throw new Error("Source sync was not saved");
    }

    return record;
  }

  async get(id: string): Promise<SourceSyncRecord | null> {
    return this.runQuery<SourceSyncRecord>("SELECT * FROM source_sync WHERE id = ?", [id], true);
  }

  async list(userId: number, projectId?: string): Promise<SourceSync[]> {
    return this.runQuery<SourceSync>(
      `SELECT ss.id, ss.project_id AS projectId, ss.provider, ss.title, ss.root_id AS rootId,
      ss.connection_id AS connectionId, ss.status, ss.last_synced_at AS lastSyncedAt, ss.next_sync_at AS nextSyncAt,
      ss.last_error AS error, (SELECT count(*) FROM source s WHERE s.sync_id = ss.id AND s.status = 'available' AND ${sourceVisibilitySql("s")}) AS documentCount
      FROM source_sync ss WHERE ${projectId ? "ss.project_id = ?" : "ss.project_id IS NULL AND ss.created_by_user_id = ?"}
      ORDER BY ss.created_at DESC`,
      [projectId ?? userId],
    );
  }

  async listDue(): Promise<SourceSyncRecord[]> {
    return this.runQuery<SourceSyncRecord>(`SELECT * FROM source_sync WHERE enabled = 1
      AND (next_sync_at IS NULL OR datetime(next_sync_at) <= datetime('now')) ORDER BY next_sync_at LIMIT 20`);
  }

  async begin(id: string, runId: string, checkpoint: SourceSyncCheckpoint): Promise<boolean> {
    const result = await this.executeRun(
      `UPDATE source_sync SET run_id = ?, page = 0, checkpoint = ?, status = 'syncing',
      next_sync_at = datetime('now', '+1 minute'), last_error = NULL
      WHERE id = ? AND enabled = 1 AND run_id IS NULL`,
      [runId, JSON.stringify(checkpoint), id],
    );

    return result.meta.changes === 1;
  }

  async checkpoint(
    id: string,
    runId: string,
    page: number,
    checkpoint: SourceSyncCheckpoint,
  ): Promise<boolean> {
    const result = await this.executeRun(
      `UPDATE source_sync SET checkpoint = ?, page = page + 1, status = 'syncing',
      next_sync_at = datetime('now', '+1 minute'), last_error = NULL
      WHERE id = ? AND run_id = ? AND page = ? AND enabled = 1`,
      [JSON.stringify(checkpoint), id, runId, page],
    );

    return result.meta.changes === 1;
  }

  async complete(id: string, runId: string, page: number): Promise<void> {
    await this.executeBatch([
      this.env.DB.prepare(`UPDATE source SET status = 'archived', permission_grants = NULL, permissions_valid_until = NULL
        WHERE sync_id = ? AND (seen_run_id IS NULL OR seen_run_id <> ?) AND EXISTS (
          SELECT 1 FROM source_sync WHERE id = ? AND run_id = ? AND page = ? AND enabled = 1
        )`).bind(id, runId, id, runId, page),
      this.env.DB.prepare(`UPDATE source_sync SET status = 'available', last_synced_at = CURRENT_TIMESTAMP,
        next_sync_at = datetime('now', '+15 minutes'), run_id = NULL, page = 0, checkpoint = '{}', last_error = NULL
        WHERE id = ? AND run_id = ? AND page = ? AND enabled = 1`).bind(id, runId, page),
    ]);
  }

  async fail(id: string, runId: string, page: number, error: string): Promise<void> {
    await this.executeRun(
      `UPDATE source_sync SET status = 'failed', last_error = ?, next_sync_at = datetime('now', '+5 minutes')
      WHERE id = ? AND run_id = ? AND page = ? AND enabled = 1`,
      [error, id, runId, page],
    );
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    await this.executeBatch([
      this.env.DB.prepare(
        "UPDATE source SET permission_grants = NULL, permissions_valid_until = NULL WHERE sync_id = ?",
      ).bind(id),
      this.env.DB.prepare(
        `UPDATE source_sync SET enabled = ?, status = ?, run_id = NULL, page = 0, checkpoint = '{}',
      next_sync_at = CURRENT_TIMESTAMP, last_error = NULL WHERE id = ?`,
      ).bind(enabled ? 1 : 0, enabled ? "pending" : "paused", id),
    ]);
  }

  async remove(id: string): Promise<void> {
    await this.executeRun("DELETE FROM source_sync WHERE id = ?", [id]);
  }

  async getSyncedSource(syncId: string, upstreamId: string): Promise<SyncedSourceRecord | null> {
    return this.runQuery<SyncedSourceRecord>(
      "SELECT id, upstream_version, content, status FROM source WHERE sync_id = ? AND upstream_id = ?",
      [syncId, upstreamId],
      true,
    );
  }

  async isManagedSource(sourceId: string): Promise<boolean> {
    const source = await this.runQuery<{ sync_id: string | null }>(
      "SELECT sync_id FROM source WHERE id = ?",
      [sourceId],
      true,
    );

    return Boolean(source?.sync_id);
  }

  async invalidatePermissions(
    syncId: string,
    upstreamId: string,
    runId: string,
    page: number,
  ): Promise<void> {
    await this.executeRun(
      `UPDATE source SET permission_grants = NULL, permissions_valid_until = NULL WHERE sync_id = ? AND upstream_id = ?
      AND EXISTS (SELECT 1 FROM source_sync WHERE id = ? AND run_id = ? AND page = ? AND enabled = 1)`,
      [syncId, upstreamId, syncId, runId, page],
    );
  }

  async storeDocument(input: {
    sync: SourceSyncRecord;
    runId: string;
    page: number;
    upstreamId: string;
    version: string | null;
    title: string;
    content: string;
    permissions: KnowledgeDocumentPermissions;
    sourceUrl: string | null;
  }): Promise<void> {
    await this.executeRun(
      `INSERT INTO source (id, created_by_user_id, project_id, connection_id, kind, title, status, content,
      provider, external_uri, sync_id, upstream_id, upstream_version, seen_run_id, permission_grants, permissions_valid_until)
      SELECT ?, ss.created_by_user_id, ss.project_id, ss.connection_id, 'connector', ?, 'available', ?, ss.provider, ?, ss.id, ?, ?, ?, ?, CASE WHEN ? IS NULL THEN datetime('now', '+20 minutes') ELSE min(datetime('now', '+20 minutes'), datetime(?)) END
      FROM source_sync ss WHERE ss.id = ? AND ss.run_id = ? AND ss.page = ? AND ss.enabled = 1
      ON CONFLICT(sync_id, upstream_id) DO UPDATE SET title = excluded.title, content = excluded.content, status = 'available',
        external_uri = excluded.external_uri, upstream_version = excluded.upstream_version, seen_run_id = excluded.seen_run_id,
        permission_grants = excluded.permission_grants, permissions_valid_until = excluded.permissions_valid_until,
        updated_at = CASE WHEN source.content IS NOT excluded.content OR source.title IS NOT excluded.title THEN CURRENT_TIMESTAMP ELSE source.updated_at END`,
      [
        generatePrefixedId("syncsource_"),
        input.title.slice(0, 200),
        input.content,
        input.sourceUrl,
        input.upstreamId,
        input.version,
        input.runId,
        JSON.stringify(input.permissions),
        input.permissions.validUntil,
        input.permissions.validUntil,
        input.sync.id,
        input.runId,
        input.page,
      ],
    );
  }

  async archiveDocument(
    syncId: string,
    upstreamId: string,
    runId: string,
    page: number,
  ): Promise<void> {
    await this.executeRun(
      `UPDATE source SET status = 'archived', permission_grants = NULL, permissions_valid_until = NULL WHERE sync_id = ? AND upstream_id = ?
      AND EXISTS (SELECT 1 FROM source_sync WHERE id = ? AND run_id = ? AND page = ? AND enabled = 1)`,
      [syncId, upstreamId, syncId, runId, page],
    );
  }
}
