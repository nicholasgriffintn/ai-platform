import { paginate } from "~/utils/arrays";
import { AssistantError, ErrorType } from "~/utils/errors";
import { parseJsonRecord } from "~/utils/json";
import { getLogger } from "~/utils/logger";

import { BaseRepository } from "./BaseRepository";
import {
  collectEmbeddingDeletionTargets,
  type ActiveEmbeddingChunk,
  type CreateEmbeddingDocument,
  type EmbeddingDeletionRow,
  type EmbeddingDocumentDeletionTarget,
  type EmbeddingDocumentProviderTarget,
  type EmbeddingInsertRecord,
  type EmbeddingLookupOptions,
  type EmbeddingScope,
} from "./embedding-records";

export type {
  ActiveEmbeddingChunk,
  CreateEmbeddingDocument,
  EmbeddingDocumentDeletionTarget,
  EmbeddingDocumentProviderTarget,
  EmbeddingInsertRecord,
} from "./embedding-records";

const MAX_SCOPED_IDS_PER_QUERY = 98;
const MAX_STATEMENTS_PER_BATCH = 50;

const logger = getLogger({ prefix: "repositories/EmbeddingRepository" });

const toUserId = (userId: EmbeddingScope["userId"]) => {
  const numericUserId = Number(userId);

  if (!Number.isSafeInteger(numericUserId) || numericUserId <= 0) {
    throw new AssistantError("Embedding scope requires a valid user", ErrorType.PARAMS_ERROR, 400);
  }

  return numericUserId;
};

export class EmbeddingRepository extends BaseRepository {
  public async createDocument(document: CreateEmbeddingDocument): Promise<void> {
    const database = this.env.DB;

    if (!database) {
      throw new AssistantError("Database not configured", ErrorType.CONFIGURATION_ERROR);
    }

    const statements = [
      database
        .prepare(
          `INSERT INTO embedding_document
             (id, scope_type, user_id, logical_id, type, title, metadata,
              lifecycle_status, provider, provider_target, embedding_model, vector_space,
              vector_space_version)
           VALUES (?, 'personal', ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
        )
        .bind(
          document.id,
          document.userId,
          document.logicalId,
          document.type,
          document.title,
          JSON.stringify(document.metadata),
          document.provider,
          document.providerTarget,
          document.embeddingModel,
          document.vectorSpace,
          document.vectorSpaceVersion,
        ),
      database
        .prepare(
          `INSERT INTO embedding_chunk
             (id, document_id, vector_id, chunk_index, content, metadata,
              lifecycle_status, provider, provider_target, embedding_model, vector_space,
              vector_space_version)
           SELECT json_extract(value, '$.id'), ?, json_extract(value, '$.vectorId'),
                  json_extract(value, '$.index'), json_extract(value, '$.content'),
                  json_extract(value, '$.metadata'), 'pending', ?, ?, ?, ?, ?
             FROM json_each(?)`,
        )
        .bind(
          document.id,
          document.provider,
          document.providerTarget,
          document.embeddingModel,
          document.vectorSpace,
          document.vectorSpaceVersion,
          JSON.stringify(
            document.chunks.map((chunk) => ({
              ...chunk,
              metadata: chunk.metadata ?? {},
            })),
          ),
        ),
    ];

    try {
      await database.batch(statements);
    } catch (error) {
      if (error instanceof Error && /unique constraint/i.test(error.message)) {
        throw new AssistantError(
          "An embedding document with this ID already exists",
          ErrorType.CONFLICT_ERROR,
          409,
        );
      }

      throw error;
    }
  }

  public async getActiveChunksByVectorIds(
    userId: number,
    vectorIds: string[],
    type?: string,
  ): Promise<ActiveEmbeddingChunk[]> {
    if (vectorIds.length === 0) {
      return [];
    }

    const typeClause = type ? "AND d.type = ?" : "";
    const pages = paginate([...new Set(vectorIds)], MAX_SCOPED_IDS_PER_QUERY);
    const rows = (
      await Promise.all(
        pages.map((page) =>
          this.runQuery<{
            vector_id: string;
            logical_id: string;
            title: string;
            content: string;
            type: string;
            metadata: string | null;
            provider: string;
            provider_target: string;
            embedding_model: string;
            vector_space: string;
            vector_space_version: string;
          }>(
            `SELECT c.vector_id, d.logical_id, d.title, c.content, d.type, d.metadata,
                    d.provider, d.provider_target, d.embedding_model, d.vector_space,
                    d.vector_space_version
         FROM embedding_chunk c
         JOIN embedding_document d ON d.id = c.document_id
        WHERE d.user_id = ?
          AND d.scope_type = 'personal'
          AND d.lifecycle_status = 'active'
          AND c.lifecycle_status = 'active'
          ${typeClause}
          AND c.vector_id IN (${page.map(() => "?").join(", ")})`,
            [userId, ...(type ? [type] : []), ...page],
          ),
        ),
      )
    ).flat();

    return rows.map((row) => ({
      vectorId: row.vector_id,
      logicalId: row.logical_id,
      title: row.title,
      content: row.content,
      type: row.type,
      metadata: parseJsonRecord(row.metadata),
      provider: row.provider,
      providerTarget: row.provider_target,
      embeddingModel: row.embedding_model,
      vectorSpace: row.vector_space,
      vectorSpaceVersion: row.vector_space_version,
    }));
  }

  public async getActiveProviderTargets(
    userId: number,
    limit?: number,
  ): Promise<EmbeddingDocumentProviderTarget[]> {
    const rows = await this.runQuery<{
      provider: string;
      provider_target: string;
      embedding_model: string;
      vector_space: string;
      vector_space_version: string;
    }>(
      `SELECT DISTINCT provider, provider_target, embedding_model, vector_space,
                       vector_space_version
         FROM embedding_document
        WHERE user_id = ?
          AND scope_type = 'personal'
          AND lifecycle_status = 'active'
        ${limit ? "LIMIT ?" : ""}`,
      [userId, ...(limit ? [limit] : [])],
    );

    return rows.map((row) => ({
      provider: row.provider,
      providerTarget: row.provider_target,
      embeddingModel: row.embedding_model,
      vectorSpace: row.vector_space,
      vectorSpaceVersion: row.vector_space_version,
    }));
  }

  public async getPendingDocumentForRetry(
    userId: number,
    logicalId: string,
  ): Promise<EmbeddingDocumentDeletionTarget | null> {
    const rows = await this.runQuery<EmbeddingDeletionRow>(
      `SELECT d.id, d.logical_id, d.provider, d.provider_target, d.embedding_model,
              d.vector_space, d.vector_space_version, c.vector_id
         FROM embedding_document d
         LEFT JOIN embedding_chunk c ON c.document_id = d.id
        WHERE d.user_id = ?
          AND d.scope_type = 'personal'
          AND d.lifecycle_status = 'pending'
          AND d.logical_id = ?
        ORDER BY c.chunk_index`,
      [userId, logicalId],
    );

    return collectEmbeddingDeletionTargets(rows)[0] ?? null;
  }

  public async getDocumentLifecycleStatus(
    userId: number,
    documentId: string,
  ): Promise<string | null> {
    const row = await this.runQuery<{ lifecycle_status: string }>(
      `SELECT lifecycle_status
         FROM embedding_document
        WHERE user_id = ? AND id = ? AND scope_type = 'personal'`,
      [userId, documentId],
      true,
    );

    return row?.lifecycle_status ?? null;
  }

  public async activateDocument(userId: number, documentId: string): Promise<void> {
    const database = this.env.DB;

    if (!database) {
      throw new AssistantError("Database not configured", ErrorType.CONFIGURATION_ERROR);
    }

    const results = await database.batch([
      database
        .prepare(
          `UPDATE embedding_document
              SET lifecycle_status = 'active', updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND id = ? AND lifecycle_status = 'pending'`,
        )
        .bind(userId, documentId),
      database
        .prepare(
          `UPDATE embedding_chunk
              SET lifecycle_status = 'active', updated_at = CURRENT_TIMESTAMP
            WHERE document_id IN (
              SELECT id FROM embedding_document WHERE user_id = ? AND id = ?
            ) AND lifecycle_status = 'pending'`,
        )
        .bind(userId, documentId),
    ]);

    if (results[0]?.meta.changes !== 1 || (results[1]?.meta.changes ?? 0) < 1) {
      throw new AssistantError(
        "Embedding document lifecycle changed during activation",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }
  }

  public async removePendingDocument(userId: number, documentId: string): Promise<void> {
    await this.executeRun(
      `DELETE FROM embedding_document
        WHERE user_id = ? AND id = ? AND lifecycle_status = 'pending'`,
      [userId, documentId],
    );
  }

  public async getDocumentsForDeletion(
    userId: number,
    logicalIds: string[],
  ): Promise<EmbeddingDocumentDeletionTarget[]> {
    if (logicalIds.length === 0) {
      return [];
    }

    const pages = paginate(logicalIds, MAX_SCOPED_IDS_PER_QUERY);
    const rows = (
      await Promise.all(
        pages.map((page) =>
          this.runQuery<EmbeddingDeletionRow>(
            `SELECT d.id, d.logical_id, d.provider, d.provider_target, d.embedding_model,
                    d.vector_space, d.vector_space_version, c.vector_id
               FROM embedding_document d
               LEFT JOIN embedding_chunk c ON c.document_id = d.id
              WHERE d.user_id = ?
                AND d.scope_type = 'personal'
                AND d.lifecycle_status IN ('pending', 'active', 'delete_pending')
                AND d.logical_id IN (${page.map(() => "?").join(", ")})
              ORDER BY d.id, c.chunk_index`,
            [userId, ...page],
          ),
        ),
      )
    ).flat();

    return collectEmbeddingDeletionTargets(rows);
  }

  public async markDocumentsDeletePending(userId: number, documentIds: string[]): Promise<void> {
    if (documentIds.length === 0) {
      return;
    }

    const database = this.env.DB;

    if (!database) {
      throw new AssistantError("Database not configured", ErrorType.CONFIGURATION_ERROR);
    }

    const pages = paginate(documentIds, MAX_SCOPED_IDS_PER_QUERY);

    await database.batch(
      pages.flatMap((page) => {
        const placeholders = page.map(() => "?").join(", ");

        return [
          database
            .prepare(
              `UPDATE embedding_document
                  SET lifecycle_status = 'delete_pending', updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND id IN (${placeholders})
                  AND lifecycle_status IN ('pending', 'active', 'delete_pending')`,
            )
            .bind(userId, ...page),
          database
            .prepare(
              `UPDATE embedding_chunk
                  SET lifecycle_status = 'delete_pending', updated_at = CURRENT_TIMESTAMP
                WHERE document_id IN (
                  SELECT id FROM embedding_document WHERE user_id = ? AND id IN (${placeholders})
                ) AND lifecycle_status IN ('pending', 'active', 'delete_pending')`,
            )
            .bind(userId, ...page),
        ];
      }),
    );
  }

  public async deleteDocuments(userId: number, documentIds: string[]): Promise<void> {
    if (documentIds.length === 0) {
      return;
    }

    const database = this.env.DB;

    if (!database) {
      throw new AssistantError("Database not configured", ErrorType.CONFIGURATION_ERROR);
    }

    const pages = paginate(documentIds, MAX_SCOPED_IDS_PER_QUERY);

    await database.batch(
      pages.flatMap((page) => {
        const placeholders = page.map(() => "?").join(", ");

        return [
          database
            .prepare(
              `DELETE FROM embedding_chunk
                WHERE document_id IN (
                  SELECT id FROM embedding_document
                   WHERE user_id = ? AND id IN (${placeholders})
                     AND lifecycle_status = 'delete_pending'
                )`,
            )
            .bind(userId, ...page),
          database
            .prepare(
              `DELETE FROM embedding_document
                WHERE user_id = ? AND id IN (${placeholders})
                  AND lifecycle_status = 'delete_pending'`,
            )
            .bind(userId, ...page),
        ];
      }),
    );
  }

  public async getEmbedding(
    id: string,
    options: EmbeddingLookupOptions,
  ): Promise<Record<string, unknown> | null> {
    const conditions: Record<string, unknown> = {
      id,
      type: options.type,
      namespace: options.namespace,
      user_id: toUserId(options.userId),
    };

    return this.findEmbedding(conditions);
  }

  private async findEmbedding(
    conditions: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const { query, values } = this.buildSelectQuery("embedding", conditions, {
      columns: ["id", "metadata", "type", "title", "content", "namespace", "user_id"],
    });

    return this.runQuery<Record<string, unknown>>(query, values, true);
  }

  public async getEmbeddingIdByType(
    id: string,
    type: string,
    scope: EmbeddingScope,
  ): Promise<Record<string, unknown> | null> {
    const { query, values } = this.buildSelectQuery(
      "embedding",
      {
        id,
        type,
        namespace: scope.namespace,
        user_id: toUserId(scope.userId),
      },
      { columns: ["id"] },
    );

    return this.runQuery<Record<string, unknown>>(query, values, true);
  }

  public async insertEmbedding(
    id: string,
    metadata: Record<string, unknown>,
    title: string,
    content: string,
    type: string,
    scope: EmbeddingScope,
  ): Promise<void> {
    const insert = this.buildInsertQuery(
      "embedding",
      {
        id,
        metadata,
        title,
        content,
        type,
        namespace: scope.namespace,
        user_id: toUserId(scope.userId),
      },
      { jsonFields: ["metadata"] },
    );

    if (!insert) {
      return;
    }

    await this.executeRun(insert.query, insert.values);
  }

  public async insertEmbeddings(
    records: EmbeddingInsertRecord[],
    scope: EmbeddingScope,
  ): Promise<void> {
    if (records.length === 0) {
      return;
    }

    const database = this.env.DB;

    if (!database) {
      throw new AssistantError("Database not configured", ErrorType.CONFIGURATION_ERROR);
    }

    const inserts = records.flatMap((record) => {
      const insert = this.buildInsertQuery(
        "embedding",
        {
          id: record.id,
          metadata: record.metadata,
          title: record.title,
          content: record.content,
          type: record.type,
          namespace: scope.namespace,
          user_id: toUserId(scope.userId),
        },
        { jsonFields: ["metadata"] },
      );

      return insert
        ? [{ id: record.id, statement: database.prepare(insert.query).bind(...insert.values) }]
        : [];
    });
    const insertedIds: string[] = [];

    for (let start = 0; start < inserts.length; start += MAX_STATEMENTS_PER_BATCH) {
      const page = inserts.slice(start, start + MAX_STATEMENTS_PER_BATCH);

      try {
        // Keep pages ordered so compensation knows exactly which IDs reached durable storage.
        // oxlint-disable-next-line eslint/no-await-in-loop
        await database.batch(page.map((insert) => insert.statement));
      } catch (error) {
        // oxlint-disable-next-line eslint/no-await-in-loop
        await this.rollbackInsertedEmbeddings(insertedIds, scope);
        throw error;
      }

      insertedIds.push(...page.map((insert) => insert.id));
    }
  }

  private async rollbackInsertedEmbeddings(ids: string[], scope: EmbeddingScope): Promise<void> {
    for (let start = 0; start < ids.length; start += MAX_SCOPED_IDS_PER_QUERY) {
      const page = ids.slice(start, start + MAX_SCOPED_IDS_PER_QUERY);

      try {
        // Bound each cleanup statement so it stays below D1's parameter limit.
        // oxlint-disable-next-line eslint/no-await-in-loop
        await this.executeRun(
          `DELETE FROM embedding
            WHERE user_id = ? AND namespace = ?
              AND id IN (${page.map(() => "?").join(", ")})`,
          [toUserId(scope.userId), scope.namespace, ...page],
        );
      } catch (error) {
        logger.warn("Failed to clean up embedding records after a failed insert batch", {
          ids: page,
          error,
        });
      }
    }
  }

  public async deleteEmbedding(id: string, scope: EmbeddingScope): Promise<void> {
    const { query, values } = this.buildDeleteQuery("embedding", {
      id,
      namespace: scope.namespace,
      user_id: toUserId(scope.userId),
    });

    await this.executeRun(query, values);
  }
}
