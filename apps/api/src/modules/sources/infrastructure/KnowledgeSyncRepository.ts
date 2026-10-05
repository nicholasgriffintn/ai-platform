import type { ConnectorKnowledgeDocument } from "@ngriffin_uk/polychat-ai-integrations";
import type { KnowledgeSyncResource } from "@ngriffin_uk/polychat-schemas";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { IEnv } from "~/types";

export interface KnowledgeSyncRecord {
  id: string;
  user_id: number;
  project_id: string;
  connection_id: string;
  recipe_id: string;
  integration_id: string;
  title: string;
  resources: string;
  status: "active" | "paused";
  interval_minutes: number;
  cursor: number;
  generation: number;
  next_sync_at: string;
  last_successful_at: string | null;
  last_error: string | null;
  lease_token: string | null;
  lease_expires_at: string | null;
}

type SyncedResource = ConnectorKnowledgeDocument & {
  sourceId: string;
  resourceId: string;
  provider: string;
  resourceCount: number;
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

  async create(input: {
    id: string;
    userId: number;
    projectId: string;
    connectionId: string;
    recipeId: string;
    integrationId: string;
    title: string;
    resources: KnowledgeSyncResource[];
    intervalMinutes: number;
  }): Promise<void> {
    await this.executeRun(
      `INSERT INTO source_knowledge_sync (id, user_id, project_id, connection_id, recipe_id, integration_id, title, resources, interval_minutes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.userId,
        input.projectId,
        input.connectionId,
        input.recipeId,
        input.integrationId,
        input.title,
        JSON.stringify(input.resources),
        input.intervalMinutes,
      ],
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
       cursor = 0, next_sync_at = CURRENT_TIMESTAMP, lease_token = NULL, lease_expires_at = NULL
       WHERE id = ?`,
      [action === "pause" ? "paused" : "active", id],
    );
  }

  async commitResource(
    sync: KnowledgeSyncRecord,
    token: string,
    resource: SyncedResource,
  ): Promise<boolean> {
    const fence = `EXISTS (SELECT 1 FROM source_knowledge_sync WHERE id = ? AND generation = ?
      AND cursor = ? AND status = 'active' AND lease_token = ? AND lease_expires_at >= CURRENT_TIMESTAMP
      AND EXISTS (SELECT 1 FROM provider_connection pc WHERE pc.id = source_knowledge_sync.connection_id
        AND pc.user_id = source_knowledge_sync.user_id AND pc.status = 'connected')
      AND EXISTS (SELECT 1 FROM project p JOIN workspace_member wm ON wm.workspace_id = p.workspace_id
        WHERE p.id = source_knowledge_sync.project_id AND wm.user_id = source_knowledge_sync.user_id AND wm.role IN ('owner', 'admin'))
      AND EXISTS (SELECT 1 FROM scoped_configuration grant_row WHERE grant_row.kind = 'capability' AND grant_row.attached = 1 AND grant_row.project_id = source_knowledge_sync.project_id
        AND grant_row.target_kind = 'recipe' AND grant_row.target_id = source_knowledge_sync.recipe_id AND grant_row.excluded = 0))`;
    const fenceValues = [sync.id, sync.generation, sync.cursor, token];
    const last = sync.cursor + 1 === resource.resourceCount;
    const results = await this.env.DB.batch([
      this.env.DB.prepare(
        `INSERT INTO source (id, created_by_user_id, project_id, connection_id, kind, title, status,
          content, provider, external_uri, metadata)
         SELECT ?, ?, ?, ?, 'connector', ?, ?, ?, ?, ?, ? WHERE ${fence}
         ON CONFLICT(id) DO UPDATE SET title = excluded.title, content = excluded.content,
           status = excluded.status, external_uri = excluded.external_uri, metadata = excluded.metadata,
           updated_at = CURRENT_TIMESTAMP
         WHERE source.created_by_user_id = excluded.created_by_user_id
           AND source.project_id = excluded.project_id AND source.connection_id = excluded.connection_id`,
      ).bind(
        resource.sourceId,
        sync.user_id,
        sync.project_id,
        sync.connection_id,
        resource.title,
        resource.status,
        resource.content,
        resource.provider,
        resource.externalUri,
        JSON.stringify({
          syncId: sync.id,
          resourceId: resource.resourceId,
          upstreamRevision: resource.upstreamRevision,
          lastSyncedAt: new Date().toISOString(),
        }),
        ...fenceValues,
      ),
      this.env.DB.prepare(
        `UPDATE source_knowledge_sync SET cursor = ?, generation = generation + ?,
           next_sync_at = CASE WHEN ? THEN datetime('now', '+' || interval_minutes || ' minutes') ELSE CURRENT_TIMESTAMP END,
           last_successful_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE last_successful_at END,
           last_error = NULL, lease_expires_at = datetime('now', '+10 minutes')
         WHERE id = ? AND generation = ? AND cursor = ? AND lease_token = ?
           AND status = 'active' AND lease_expires_at >= CURRENT_TIMESTAMP
           AND EXISTS (SELECT 1 FROM source WHERE id = ? AND project_id = ? AND created_by_user_id = ?
             AND connection_id = ?) AND ${fence}`,
      ).bind(
        last ? 0 : sync.cursor + 1,
        last ? 1 : 0,
        last ? 1 : 0,
        last ? 1 : 0,
        ...fenceValues,
        resource.sourceId,
        sync.project_id,
        sync.user_id,
        sync.connection_id,
        ...fenceValues,
      ),
    ]);

    return results[1]?.meta.changes === 1;
  }

  async markUnavailable(sync: KnowledgeSyncRecord, token: string, sourceId: string): Promise<void> {
    await this.executeRun(
      `UPDATE source SET status = 'archived', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND project_id = ? AND created_by_user_id = ? AND connection_id = ?
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
