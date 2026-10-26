import type {
  KnowledgeSyncCheckpoint,
  KnowledgeFeed,
  KnowledgeSyncKind,
  KnowledgeSyncResource,
} from "@ngriffin_uk/polychat-schemas";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { IEnv } from "~/types";

export interface KnowledgeSyncRecord {
  id: string;
  user_id: number;
  project_id: string | null;
  collection_id: string | null;
  kind: KnowledgeSyncKind;
  connection_id: string | null;
  recipe_id: string | null;
  integration_id: string | null;
  title: string;
  resources: string | null;
  feed: string | null;
  status: "active" | "paused";
  interval_minutes: number;
  cursor: number;
  generation: number;
  next_sync_at: string;
  last_successful_at: string | null;
  last_error: string | null;
  lease_token: string | null;
  lease_expires_at: string | null;
  checkpoint: string | null;
}

export type ConnectorKnowledgeSyncRecord = KnowledgeSyncRecord & {
  kind: "connector";
  connection_id: string;
  recipe_id: string;
  integration_id: string;
  resources: string;
};

export class KnowledgeSyncRepository extends BaseRepository<Pick<IEnv, "DB">> {
  get(id: string): Promise<KnowledgeSyncRecord | null> {
    return this.runQuery("SELECT * FROM source_knowledge_sync WHERE id = ?", [id], true);
  }

  list(projectId: string): Promise<KnowledgeSyncRecord[]> {
    return this.runQuery(
      "SELECT * FROM source_knowledge_sync WHERE project_id = ? ORDER BY title",
      [projectId],
    );
  }

  listForLibrary(userId: number): Promise<KnowledgeSyncRecord[]> {
    return this.runQuery(
      "SELECT * FROM source_knowledge_sync WHERE user_id = ? AND project_id IS NULL AND collection_id IS NULL ORDER BY title",
      [userId],
    );
  }

  listForCollection(collectionId: string): Promise<KnowledgeSyncRecord[]> {
    return this.runQuery(
      "SELECT * FROM source_knowledge_sync WHERE collection_id = ? ORDER BY title",
      [collectionId],
    );
  }

  async create(
    input: {
      id: string;
      userId: number;
      projectId: string | null;
      collectionId: string | null;
      title: string;
      intervalMinutes: number;
    } & (
      | {
          kind: "connector";
          connectionId: string;
          recipeId: string;
          integrationId: string;
          resources: KnowledgeSyncResource[];
        }
      | { kind: KnowledgeFeed["kind"]; feed: KnowledgeFeed }
    ),
  ): Promise<void> {
    const connector = input.kind === "connector" ? input : null;
    const feed = "feed" in input ? input.feed : null;

    await this.executeRun(
      `INSERT INTO source_knowledge_sync (id, user_id, project_id, collection_id, kind, connection_id, recipe_id, integration_id, title, resources, feed, interval_minutes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.userId,
        input.projectId,
        input.collectionId,
        input.kind,
        connector?.connectionId ?? null,
        connector?.recipeId ?? null,
        connector?.integrationId ?? null,
        input.title,
        connector ? JSON.stringify(connector.resources) : null,
        feed ? JSON.stringify(feed) : null,
        input.intervalMinutes,
      ],
    );
  }

  async delete(id: string): Promise<void> {
    await this.executeRun("DELETE FROM source_knowledge_sync WHERE id = ?", [id]);
  }

  async completeFeedRun(sync: KnowledgeSyncRecord, token: string): Promise<boolean> {
    const result = await this.executeRun(
      `UPDATE source_knowledge_sync SET generation = generation + 1, cursor = 0,
         next_sync_at = datetime('now', '+' || interval_minutes || ' minutes'),
         last_successful_at = CURRENT_TIMESTAMP, last_error = NULL
       WHERE id = ? AND generation = ? AND kind != 'connector' AND status = 'active'
         AND lease_token = ? AND lease_expires_at >= CURRENT_TIMESTAMP`,
      [sync.id, sync.generation, token],
    );

    return result.meta.changes === 1;
  }

  async deferFeedRun(sync: KnowledgeSyncRecord, token: string): Promise<void> {
    await this.executeRun(
      `UPDATE source_knowledge_sync SET next_sync_at = datetime('now', '+' || interval_minutes || ' minutes')
       WHERE id = ? AND kind != 'connector' AND lease_token = ?`,
      [sync.id, token],
    );
  }

  due(): Promise<KnowledgeSyncRecord[]> {
    return this.runQuery(
      `SELECT * FROM source_knowledge_sync WHERE status = 'active' AND next_sync_at <= CURRENT_TIMESTAMP
       AND (lease_token IS NULL OR lease_expires_at < CURRENT_TIMESTAMP) ORDER BY next_sync_at LIMIT 50`,
    );
  }

  async claim(id: string, generation: number, token: string): Promise<boolean> {
    const result = await this.executeRun(
      `UPDATE source_knowledge_sync SET lease_token = ?, lease_expires_at = datetime('now', '+10 minutes')
       WHERE id = ? AND generation = ? AND status = 'active'
         AND (lease_token IS NULL OR lease_expires_at < CURRENT_TIMESTAMP)`,
      [token, id, generation],
    );

    return result.meta.changes === 1;
  }

  async release(id: string, token: string, error: string | null, pause = false): Promise<void> {
    await this.executeRun(
      `UPDATE source_knowledge_sync SET lease_token = NULL, lease_expires_at = NULL, last_error = ?,
         status = CASE WHEN ? THEN 'paused' ELSE status END,
         generation = generation + ?
       WHERE id = ? AND lease_token = ?`,
      [error, pause ? 1 : 0, pause ? 1 : 0, id, token],
    );
  }

  async control(id: string, action: "pause" | "resume" | "refresh"): Promise<void> {
    await this.executeRun(
      `UPDATE source_knowledge_sync SET status = ?, generation = generation + 1,
       cursor = 0, checkpoint = NULL, next_sync_at = CURRENT_TIMESTAMP, lease_token = NULL, lease_expires_at = NULL
       WHERE id = ?`,
      [action === "pause" ? "paused" : "active", id],
    );
  }

  private writeFence(sync: ConnectorKnowledgeSyncRecord, token: string) {
    return {
      sql: `EXISTS (SELECT 1 FROM source_knowledge_sync WHERE id = ? AND generation = ?
      AND cursor = ? AND status = 'active' AND lease_token = ? AND lease_expires_at >= CURRENT_TIMESTAMP
      AND EXISTS (SELECT 1 FROM provider_connection pc WHERE pc.id = source_knowledge_sync.connection_id
        AND pc.user_id = source_knowledge_sync.user_id AND pc.status = 'connected')
      AND ((source_knowledge_sync.project_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM project p JOIN resource_grant wm ON wm.kind = 'membership' AND wm.workspace_id = p.workspace_id
          WHERE p.id = source_knowledge_sync.project_id AND wm.user_id = source_knowledge_sync.user_id AND wm.role IN ('owner', 'admin'))
        AND EXISTS (SELECT 1 FROM scoped_configuration grant_row WHERE grant_row.kind = 'capability' AND grant_row.attached = 1 AND grant_row.project_id = source_knowledge_sync.project_id
          AND grant_row.target_kind = 'recipe' AND grant_row.target_id = source_knowledge_sync.recipe_id AND grant_row.excluded = 0))
      OR (source_knowledge_sync.collection_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM resource_collection notebook WHERE notebook.id = source_knowledge_sync.collection_id
          AND notebook.collection_type = 'conversation' AND notebook.project_id IS NULL
          AND notebook.owner_user_id = source_knowledge_sync.user_id))))`,
      values: [sync.id, sync.generation, sync.cursor, token],
    };
  }

  async holdsWriteLease(sync: ConnectorKnowledgeSyncRecord, token: string): Promise<boolean> {
    const fence = this.writeFence(sync, token);
    const result = await this.executeRun(
      `UPDATE source_knowledge_sync SET lease_expires_at = datetime('now', '+10 minutes')
       WHERE id = ? AND ${fence.sql}`,
      [sync.id, ...fence.values],
    );

    return result.meta.changes === 1;
  }

  async saveCheckpoint(
    sync: ConnectorKnowledgeSyncRecord,
    token: string,
    checkpoint: KnowledgeSyncCheckpoint,
  ): Promise<boolean> {
    const fence = this.writeFence(sync, token);
    const result = await this.executeRun(
      `UPDATE source_knowledge_sync SET checkpoint = ?, last_error = NULL,
         lease_expires_at = datetime('now', '+10 minutes')
       WHERE id = ? AND ${fence.sql}`,
      [JSON.stringify(checkpoint), sync.id, ...fence.values],
    );

    return result.meta.changes === 1;
  }

  async advanceResource(
    sync: ConnectorKnowledgeSyncRecord,
    token: string,
    resourceCount: number,
    checkpoint: KnowledgeSyncCheckpoint,
  ): Promise<boolean> {
    const fence = this.writeFence(sync, token);
    const last = sync.cursor + 1 >= resourceCount;
    const result = await this.executeRun(
      `UPDATE source_knowledge_sync SET cursor = ?, generation = generation + ?, checkpoint = ?,
         next_sync_at = CASE WHEN ? THEN datetime('now', '+' || interval_minutes || ' minutes') ELSE CURRENT_TIMESTAMP END,
         last_successful_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE last_successful_at END,
         last_error = NULL, lease_expires_at = datetime('now', '+10 minutes')
       WHERE id = ? AND ${fence.sql}`,
      [
        last ? 0 : sync.cursor + 1,
        last ? 1 : 0,
        JSON.stringify(checkpoint),
        last ? 1 : 0,
        last ? 1 : 0,
        sync.id,
        ...fence.values,
      ],
    );

    return result.meta.changes === 1;
  }

  async markItemsSeen(
    sync: ConnectorKnowledgeSyncRecord,
    pass: number,
    sourceIds: readonly string[],
  ): Promise<void> {
    if (sourceIds.length === 0) {
      return;
    }

    await this.executeRun(
      `UPDATE resource SET metadata = json_set(metadata, '$.syncPass', ?)
       WHERE resource_type = 'source' AND id IN (SELECT value FROM json_each(?))
         AND json_extract(metadata, '$.syncId') = ? AND created_by_user_id = ?`,
      [pass, JSON.stringify(sourceIds), sync.id, sync.user_id],
    );
  }

  async archiveUnseen(
    sync: ConnectorKnowledgeSyncRecord,
    resourceId: string,
    pass: number,
  ): Promise<number> {
    const result = await this.executeRun(
      `UPDATE resource SET status = 'archived', updated_at = CURRENT_TIMESTAMP
       WHERE resource_type = 'source' AND status != 'archived'
         AND json_extract(metadata, '$.syncId') = ? AND json_extract(metadata, '$.syncResource') = ?
         AND json_extract(metadata, '$.syncPass') IS NOT ? AND created_by_user_id = ?`,
      [sync.id, resourceId, pass, sync.user_id],
    );

    return result.meta.changes;
  }

  async markUnavailable(
    sync: ConnectorKnowledgeSyncRecord,
    token: string,
    sourceId: string,
  ): Promise<void> {
    await this.executeRun(
      `UPDATE resource SET status = 'archived', updated_at = CURRENT_TIMESTAMP
       WHERE resource_type = 'source' AND id = ? AND project_id IS ? AND created_by_user_id = ? AND connection_id = ?
         AND EXISTS (SELECT 1 FROM source_knowledge_sync WHERE id = ? AND generation = ?
           AND cursor = ? AND status = 'active' AND lease_token = ? AND lease_expires_at >= CURRENT_TIMESTAMP)`,
      [
        sourceId,
        sync.project_id,
        sync.user_id,
        sync.connection_id,
        sync.id,
        sync.generation,
        sync.cursor,
        token,
      ],
    );
  }
}
