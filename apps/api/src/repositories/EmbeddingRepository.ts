import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

import { BaseRepository } from "./BaseRepository";

// D1 runs a batch as a single transaction and caps bound parameters per statement, so both the
// insert batches and the compensating delete are split into fixed-size pages.
const MAX_STATEMENTS_PER_BATCH = 50;
const MAX_BOUND_PARAMETERS = 100;

const logger = getLogger({ prefix: "repositories/EmbeddingRepository" });

export type EmbeddingInsertRecord = {
  id: string;
  metadata: Record<string, unknown>;
  title: string;
  content: string;
  type: string;
};

type EmbeddingScope = {
  namespace?: string;
  userId?: number | string | null;
};

type EmbeddingLookupOptions = EmbeddingScope & {
  type?: string;
  allowUnscopedFallback?: boolean;
};

const toUserId = (userId: EmbeddingScope["userId"]) => {
  if (userId === undefined || userId === null || userId === "") {
    return undefined;
  }

  const numericUserId = Number(userId);

  return Number.isFinite(numericUserId) ? numericUserId : undefined;
};

export class EmbeddingRepository extends BaseRepository {
  public async getEmbedding(
    id: string,
    typeOrOptions?: string | EmbeddingLookupOptions,
  ): Promise<Record<string, unknown> | null> {
    const options =
      typeof typeOrOptions === "string" ? { type: typeOrOptions } : typeOrOptions || {};
    const conditions: Record<string, unknown> = {
      id,
      type: options.type,
      namespace: options.namespace,
      user_id: toUserId(options.userId),
    };

    let embedding = await this.findEmbedding(conditions);

    if (!embedding && options.allowUnscopedFallback && options.namespace) {
      embedding = await this.findEmbedding({
        ...conditions,
        user_id: null,
      });
    }

    if (!embedding && options.allowUnscopedFallback && options.namespace) {
      embedding = await this.findEmbedding({
        ...conditions,
        namespace: null,
        user_id: null,
      });
    }

    return embedding;
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
    scope: EmbeddingScope = {},
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
    scope: EmbeddingScope = {},
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
    scope: EmbeddingScope = {},
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
        await database.batch(page.map((insert) => insert.statement));
      } catch (error) {
        await this.rollbackInsertedEmbeddings(insertedIds);
        throw error;
      }

      insertedIds.push(...page.map((insert) => insert.id));
    }
  }

  private async rollbackInsertedEmbeddings(ids: string[]): Promise<void> {
    for (let start = 0; start < ids.length; start += MAX_BOUND_PARAMETERS) {
      const page = ids.slice(start, start + MAX_BOUND_PARAMETERS);

      try {
        await this.executeRun(
          `DELETE FROM embedding WHERE id IN (${page.map(() => "?").join(", ")})`,
          page,
        );
      } catch (error) {
        logger.warn("Failed to clean up embedding records after a failed insert batch", {
          ids: page,
          error,
        });
      }
    }
  }

  public async deleteEmbedding(id: string): Promise<void> {
    const { query, values } = this.buildDeleteQuery("embedding", { id });

    await this.executeRun(query, values);
  }
}
