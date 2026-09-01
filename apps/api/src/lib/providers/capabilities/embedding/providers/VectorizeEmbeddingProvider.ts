import type { Ai, Vectorize } from "@cloudflare/workers-types";

import { gatewayId } from "~/constants/app";
import { WORKERS_EMBEDDING_MODEL } from "~/lib/providers/capabilities/embedding/constants";
import {
  buildVectorizeMetadataFilter,
  requireEmbeddingScopeTag,
  withEmbeddingScopeMetadata,
} from "~/lib/providers/capabilities/embedding/utils/scope";
import { addInfraUsage } from "~/lib/usage/requestMeter";
import type { RepositoryManager } from "~/repositories";
import type {
  EmbeddingMutationResult,
  EmbeddingProvider,
  EmbeddingQueryOptions,
  EmbeddingQueryResult,
  EmbeddingVector,
  EmbeddingWriteOptions,
  NumericEmbeddingQuery,
} from "~/types";
import { paginate } from "~/utils/arrays";
import { parseEmbeddingVectors } from "~/utils/embeddings";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/embedding/vectorize" });
const MAX_VECTORIZE_DELETE_IDS = 500;

export interface VectorizeEmbeddingProviderConfig {
  ai: Ai;
  vector_db: Vectorize;
  repositories: RepositoryManager;
}

export class VectorizeEmbeddingProvider implements EmbeddingProvider {
  private ai: Ai;
  private vector_db: Vectorize;

  constructor(config: VectorizeEmbeddingProviderConfig) {
    this.ai = config.ai;
    this.vector_db = config.vector_db;
  }

  async generate(
    type: string,
    content: string,
    id: string,
    metadata: Record<string, unknown>,
  ): Promise<EmbeddingVector[]> {
    try {
      if (!type || !content || !id) {
        throw new AssistantError(
          "Missing type, content or id from request",
          ErrorType.PARAMS_ERROR,
        );
      }

      logger.debug("Generating embeddings with Vectorize", { type });

      const response = await this.ai.run(
        WORKERS_EMBEDDING_MODEL,
        { text: [content] },
        {
          gateway: {
            id: gatewayId,
            skipCache: false,
            cacheTtl: 259200, // 3 days
          },
        },
      );

      const mergedMetadata = { ...metadata, type };
      const data = parseEmbeddingVectors(response, "No data returned from Vectorize API").map(
        (vector) => ({
          id,
          values: vector,
          metadata: mergedMetadata,
        }),
      );

      logger.debug("Vectorize embedding generation completed");

      return data;
    } catch (error) {
      logger.error("Vectorize embedding generation failed");
      throw error;
    }
  }

  async insert(
    embeddings: EmbeddingVector[],
    options: EmbeddingWriteOptions = {},
  ): Promise<EmbeddingMutationResult> {
    const scopeTag = requireEmbeddingScopeTag(options);

    try {
      logger.debug("Inserting embeddings into Vectorize Vector DB", {
        count: embeddings.length,
      });

      await this.vector_db.upsert(
        embeddings.map((embedding) => ({
          id: embedding.id,
          values: embedding.values,
          metadata: withEmbeddingScopeMetadata(embedding.metadata, options),
          namespace: scopeTag,
        })),
      );

      addInfraUsage(
        "vectorize_stored_dimensions",
        embeddings.reduce((total, embedding) => total + embedding.values.length, 0),
      );

      logger.debug("Vectorize Vector DB upsert response", {
        status: "success",
      });

      return {
        status: "success",
        error: null,
      };
    } catch (error) {
      logger.error("Failed to insert Vectorize embeddings");
      throw error instanceof Error ? error : new AssistantError("Vector DB insert failed");
    }
  }

  async delete(ids: string[]) {
    try {
      logger.debug("Deleting embeddings from Vectorize Vector DB", { count: ids.length });
      await Promise.all(
        paginate(ids, MAX_VECTORIZE_DELETE_IDS).map((page) => this.vector_db.deleteByIds(page)),
      );

      return {
        status: "success",
        error: null,
      };
    } catch (error) {
      logger.error("Failed to delete Vectorize embeddings");
      throw error instanceof Error ? error : new AssistantError("Vector DB delete failed");
    }
  }

  async getQuery(query: string): Promise<{ data: any; status: { success: boolean } }> {
    logger.debug("Generating query embedding with Vectorize");
    const response = await this.ai.run(
      WORKERS_EMBEDDING_MODEL,
      { text: [query] },
      {
        gateway: {
          id: gatewayId,
          skipCache: false,
          cacheTtl: 259200, // 3 days
        },
      },
    );

    const vectors = parseEmbeddingVectors(response, "No data returned from Vectorize API");

    logger.debug("Vectorize query embedding completed");

    return {
      data: vectors,
      status: { success: true },
    };
  }

  async getMatches(
    queryVector: NumericEmbeddingQuery,
    options: EmbeddingQueryOptions = {},
  ): Promise<EmbeddingQueryResult> {
    logger.debug("Querying Vectorize Vector DB");
    const scopeTag = requireEmbeddingScopeTag(options);
    const metadataFilter = buildVectorizeMetadataFilter(options);
    const queryOptions = {
      topK: options.topK ?? 15,
      returnValues: options.returnValues ?? false,
      returnMetadata: options.returnMetadata ?? "none",
      namespace: scopeTag,
      ...(metadataFilter && { filter: metadataFilter }),
    };
    const queryValues = Array.from(queryVector);
    const matches = await this.vector_db.query(queryValues, queryOptions);

    addInfraUsage("vectorize_queried_dimensions", queryValues.length * (1 + queryOptions.topK));

    logger.debug("Vectorize Vector DB query completed", { count: matches.matches?.length || 0 });

    return {
      matches:
        matches.matches?.map((match) => ({
          id: match.id,
          score: match.score || 0,
          metadata: match.metadata || {},
        })) || [],
      count: matches.matches?.length || 0,
    };
  }
}
