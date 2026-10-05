import type { SourceCollectionKind, SourceKind, SourceStatus } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";

import { sourceVisibilitySql } from "./source-visibility";

export interface SourceRecord {
  id: string;
  created_by_user_id: number;
  project_id: string | null;
  conversation_id: string | null;
  connection_id: string | null;
  kind: SourceKind;
  title: string;
  status: SourceStatus;
  content: string | null;
  provider: string | null;
  external_uri: string | null;
  vector_id: string | null;
  metadata: string;
  storage_key: string | null;
  mime_type: string | null;
  filename: string | null;
  byte_size: number | null;
  created_at: string;
  updated_at: string | null;
}

export const SOURCE_SUMMARY_COLUMNS = [
  "id",
  "created_by_user_id",
  "project_id",
  "conversation_id",
  "connection_id",
  "kind",
  "title",
  "status",
  "provider",
  "external_uri",
  "vector_id",
  "metadata",
  "storage_key",
  "mime_type",
  "filename",
  "byte_size",
  "created_at",
  "updated_at",
] as const;

export type SourceSummaryRecord = Omit<SourceRecord, "content">;

export interface CreateSourceRecord {
  id?: string;
  createdByUserId: number;
  projectId?: string | null;
  conversationId?: string | null;
  connectionId?: string | null;
  kind: SourceKind;
  title: string;
  status?: SourceStatus;
  content?: string | null;
  provider?: string | null;
  externalUri?: string | null;
  vectorId?: string | null;
  metadata?: Record<string, unknown>;
  storageKey?: string | null;
  mimeType?: string | null;
  filename?: string | null;
  byteSize?: number | null;
}

export interface SourceCollectionRecord {
  id: string;
  created_by_user_id: number;
  project_id: string | null;
  title: string;
  description: string | null;
  kind: SourceCollectionKind;
  created_at: string;
  updated_at: string | null;
  source_count?: number;
}

export class SourceRepository extends BaseRepository {
  async upsertRepositorySource(input: {
    id: string;
    userId: number;
    projectId?: string;
    title: string;
    content: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    const result = await this.executeRun(
      `INSERT INTO source (id, created_by_user_id, project_id, kind, title, status, content, metadata)
      VALUES (?, ?, ?, 'repository', ?, 'available', ?, ?)
      ON CONFLICT(id) DO UPDATE SET title = excluded.title, status = 'available', content = excluded.content,
        metadata = excluded.metadata, updated_at = CURRENT_TIMESTAMP
      WHERE source.created_by_user_id = excluded.created_by_user_id
        AND source.project_id IS excluded.project_id AND source.kind = 'repository'`,
      [
        input.id,
        input.userId,
        input.projectId ?? null,
        input.title,
        input.content,
        JSON.stringify(input.metadata),
      ],
    );

    if (result.meta.changes === 0) {
      throw new AssistantError("Repository source scope mismatch", ErrorType.CONFLICT_ERROR, 409);
    }
  }

  async removeCreatedSources(
    userId: number,
    projectId: string | null,
    ids: string[],
  ): Promise<void> {
    await this.selectInChunks(ids, async (page) => {
      await this.executeRun(
        `DELETE FROM source WHERE created_by_user_id = ? AND project_id IS ? AND id IN (${page.map(() => "?").join(", ")})`,
        [userId, projectId, ...page],
      );

      return [];
    });
  }

  async createSource(input: CreateSourceRecord): Promise<SourceRecord> {
    const { source, created } = await this.createSourceWithOutcome(input);

    if (!created) {
      throw new AssistantError("Source already exists", ErrorType.DATABASE_ERROR);
    }

    return source;
  }

  async createSourceWithOutcome(
    input: CreateSourceRecord,
  ): Promise<{ source: SourceRecord; created: boolean }> {
    const insert = this.buildInsertQuery(
      "source",
      {
        id: input.id ?? generateId(),
        created_by_user_id: input.createdByUserId,
        project_id: input.projectId ?? null,
        conversation_id: input.conversationId ?? null,
        connection_id: input.connectionId ?? null,
        kind: input.kind,
        title: input.title,
        status: input.status ?? "available",
        content: input.content ?? null,
        provider: input.provider ?? null,
        external_uri: input.externalUri ?? null,
        vector_id: input.vectorId ?? null,
        metadata: input.metadata ?? {},
        storage_key: input.storageKey ?? null,
        mime_type: input.mimeType ?? null,
        filename: input.filename ?? null,
        byte_size: input.byteSize ?? null,
      },
      { jsonFields: ["metadata"], returning: "*" },
    );

    if (!insert) {
      throw new AssistantError("Failed to build source insert", ErrorType.INTERNAL_ERROR);
    }

    const source = await this.runQuery<SourceRecord>(
      input.id
        ? insert.query.replace(" RETURNING ", " ON CONFLICT(id) DO NOTHING RETURNING ")
        : insert.query,
      insert.values,
      true,
    );

    if (!source) {
      const existing = input.id ? await this.getSource(input.id) : null;

      if (
        existing &&
        existing.project_id === (input.projectId ?? null) &&
        existing.created_by_user_id === input.createdByUserId
      ) {
        return { source: existing, created: false };
      }

      throw new AssistantError("Failed to create source", ErrorType.DATABASE_ERROR);
    }

    return { source, created: true };
  }

  async getSource(sourceId: string): Promise<SourceRecord | null> {
    return this.selectOne({ id: sourceId });
  }

  async getSourcesByIds(sourceIds: readonly string[]): Promise<SourceRecord[]> {
    return this.selectInChunks(sourceIds, (page) =>
      this.runQuery<SourceRecord>(
        `SELECT * FROM source WHERE id IN (${page.map(() => "?").join(", ")}) AND ${sourceVisibilitySql("source")}`,
        page,
      ),
    );
  }

  async getSourceByVectorId(vectorId: string): Promise<SourceRecord | null> {
    return this.selectOne({ vector_id: vectorId });
  }

  async getPersonalSource(userId: number, sourceId: string): Promise<SourceRecord | null> {
    return this.selectOne({ id: sourceId, created_by_user_id: userId, project_id: null });
  }

  async getProjectSource(projectId: string, sourceId: string): Promise<SourceRecord | null> {
    return this.selectOne({ id: sourceId, project_id: projectId });
  }

  async listPersonalSources(userId: number, kind?: SourceKind): Promise<SourceRecord[]> {
    return this.selectMany({ created_by_user_id: userId, project_id: null, kind });
  }

  async listProjectSources(projectId: string, kind?: SourceKind): Promise<SourceRecord[]> {
    return this.selectMany({ project_id: projectId, kind });
  }

  async listPersonalSourceSummaries(
    userId: number,
    kind?: SourceKind,
  ): Promise<SourceSummaryRecord[]> {
    return this.selectSummaries({ created_by_user_id: userId, project_id: null, kind });
  }

  async listProjectSourceSummaries(
    projectId: string,
    kind?: SourceKind,
  ): Promise<SourceSummaryRecord[]> {
    return this.selectSummaries({ project_id: projectId, kind });
  }

  async updateSource(
    sourceId: string,
    updates: {
      title?: string;
      status?: SourceStatus;
      content?: string | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    const result = this.buildUpdateQuery(
      "source",
      updates,
      ["title", "status", "content", "metadata"],
      "id = ?",
      [sourceId],
      { jsonFields: ["metadata"] },
    );

    if (result) {
      await this.executeRun(result.query, result.values);
    }
  }

  async transitionSourceStatus(
    sourceId: string,
    expectedStatuses: SourceStatus[],
    status: SourceStatus,
  ): Promise<boolean> {
    if (expectedStatuses.length === 0) {
      return false;
    }

    const result = await this.executeRun(
      `UPDATE source
          SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status IN (${expectedStatuses.map(() => "?").join(", ")})`,
      [status, sourceId, ...expectedStatuses],
    );

    return result.meta.changes === 1;
  }

  async updateCollection(
    collectionId: string,
    updates: { title?: string; description?: string | null },
  ): Promise<void> {
    const result = this.buildUpdateQuery(
      "source_collection",
      updates,
      ["title", "description"],
      "id = ?",
      [collectionId],
    );

    if (result) {
      await this.executeRun(result.query, result.values);
    }
  }

  async deleteSource(sourceId: string): Promise<void> {
    const { query, values } = this.buildDeleteQuery("source", { id: sourceId });

    await this.executeRun(query, values);
  }

  async createCollection(input: {
    createdByUserId: number;
    projectId?: string | null;
    title: string;
    description?: string | null;
    kind?: SourceCollectionKind;
  }): Promise<SourceCollectionRecord> {
    const insert = this.buildInsertQuery(
      "source_collection",
      {
        id: generateId(),
        created_by_user_id: input.createdByUserId,
        project_id: input.projectId ?? null,
        title: input.title,
        description: input.description ?? null,
        kind: input.kind ?? "general",
      },
      { returning: "*" },
    );

    if (!insert) {
      throw new AssistantError("Failed to build source collection", ErrorType.INTERNAL_ERROR);
    }

    const collection = await this.runQuery<SourceCollectionRecord>(
      insert.query,
      insert.values,
      true,
    );

    if (!collection) {
      throw new AssistantError("Failed to create source collection", ErrorType.DATABASE_ERROR);
    }

    return collection;
  }

  async listPersonalCollections(userId: number): Promise<SourceCollectionRecord[]> {
    return this.listCollections("sc.created_by_user_id = ? AND sc.project_id IS NULL", [userId]);
  }

  async listProjectCollections(projectId: string): Promise<SourceCollectionRecord[]> {
    return this.listCollections("sc.project_id = ?", [projectId]);
  }

  async getCollection(collectionId: string): Promise<SourceCollectionRecord | null> {
    const { query, values } = this.buildSelectQuery("source_collection", { id: collectionId });

    return this.runQuery<SourceCollectionRecord>(query, values, true);
  }

  async getProjectContextCollection(projectId: string): Promise<SourceCollectionRecord | null> {
    const { query, values } = this.buildSelectQuery("source_collection", {
      project_id: projectId,
      kind: "context",
    });

    return this.runQuery<SourceCollectionRecord>(query, values, true);
  }

  async ensureProjectContextCollection(params: {
    projectId: string;
    createdByUserId: number;
  }): Promise<SourceCollectionRecord> {
    const id = `project-context:${params.projectId}`;

    await this.executeRun(
      `INSERT OR IGNORE INTO source_collection
			 (id, created_by_user_id, project_id, title, description, kind)
			 VALUES (?, ?, ?, 'Project context', 'Sources attached to new project conversations.', 'context')`,
      [id, params.createdByUserId, params.projectId],
    );
    const collection = await this.getCollection(id);

    if (!collection) {
      throw new AssistantError(
        "Failed to create project context collection",
        ErrorType.DATABASE_ERROR,
      );
    }

    return collection;
  }

  async listCollectionSources(collectionId: string): Promise<SourceRecord[]> {
    return this.runQuery<SourceRecord>(
      `SELECT s.* FROM source s
			 JOIN source_collection_member scm ON scm.source_id = s.id
			 WHERE scm.collection_id = ? AND ${sourceVisibilitySql("s")}
			 ORDER BY s.updated_at DESC, s.created_at DESC`,
      [collectionId],
    );
  }

  async addCollectionSources(collectionId: string, sourceIds: string[]): Promise<number> {
    if (!this.env.DB || sourceIds.length === 0) {
      return 0;
    }

    const results = await this.env.DB.batch(
      sourceIds.map((sourceId) =>
        this.env.DB.prepare(
          "INSERT OR IGNORE INTO source_collection_member (collection_id, source_id) VALUES (?, ?)",
        ).bind(collectionId, sourceId),
      ),
    );

    return results.filter((result) => result.success && result.meta.changes > 0).length;
  }

  async replaceCollectionSources(collectionId: string, sourceIds: string[]): Promise<void> {
    if (!this.env.DB) {
      return;
    }

    await this.env.DB.batch([
      this.env.DB.prepare("DELETE FROM source_collection_member WHERE collection_id = ?").bind(
        collectionId,
      ),
      ...sourceIds.map((sourceId) =>
        this.env.DB.prepare(
          "INSERT INTO source_collection_member (collection_id, source_id) VALUES (?, ?)",
        ).bind(collectionId, sourceId),
      ),
    ]);
  }

  async removeSourceFromCollections(sourceId: string): Promise<void> {
    const { query, values } = this.buildDeleteQuery("source_collection_member", {
      source_id: sourceId,
    });

    await this.executeRun(query, values);
  }

  async deleteCollection(collectionId: string): Promise<void> {
    const { query, values } = this.buildDeleteQuery("source_collection", { id: collectionId });

    await this.executeRun(query, values);
  }

  private async selectOne(conditions: Record<string, unknown>): Promise<SourceRecord | null> {
    const { query, values } = this.buildSelectQuery("source", conditions);

    return this.runQuery<SourceRecord>(
      `SELECT source.* FROM (${query}) source WHERE ${sourceVisibilitySql("source")}`,
      values,
      true,
    );
  }

  private async selectMany(conditions: Record<string, unknown>): Promise<SourceRecord[]> {
    const { query, values } = this.buildSelectQuery("source", conditions, {
      orderBy: "updated_at DESC, created_at DESC",
    });

    return this.runQuery<SourceRecord>(
      `SELECT source.* FROM (${query}) source WHERE ${sourceVisibilitySql("source")} ORDER BY source.updated_at DESC, source.created_at DESC`,
      values,
    );
  }

  private async selectSummaries(
    conditions: Record<string, unknown>,
  ): Promise<SourceSummaryRecord[]> {
    const { query, values } = this.buildSelectQuery("source", conditions, {
      columns: [...SOURCE_SUMMARY_COLUMNS],
      orderBy: "updated_at DESC, created_at DESC",
    });

    return this.runQuery<SourceSummaryRecord>(
      `SELECT ${SOURCE_SUMMARY_COLUMNS.join(", ")} FROM (${query}) source WHERE ${sourceVisibilitySql("source")} ORDER BY source.updated_at DESC, source.created_at DESC`,
      values,
    );
  }

  private async listCollections(
    where: string,
    values: unknown[],
  ): Promise<SourceCollectionRecord[]> {
    return this.runQuery<SourceCollectionRecord>(
      `SELECT sc.*, COUNT(s.id) AS source_count
			 FROM source_collection sc
			 LEFT JOIN source_collection_member scm ON scm.collection_id = sc.id
         LEFT JOIN source s ON s.id = scm.source_id AND ${sourceVisibilitySql("s")}
			 WHERE ${where}
			 GROUP BY sc.id
			 ORDER BY sc.updated_at DESC, sc.created_at DESC`,
      values,
    );
  }
}
