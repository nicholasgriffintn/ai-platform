import type { Ai, VectorFloatArray, Vectorize } from "@cloudflare/workers-types";

import { gatewayId } from "~/constants/app";
import { WORKERS_EMBEDDING_MODEL } from "~/lib/providers/capabilities/embedding/constants";
import {
  buildVectorizeMetadataFilter,
  getEmbeddingContentType,
  requireEmbeddingScopeTag,
  withEmbeddingScopeMetadata,
} from "~/lib/providers/capabilities/embedding/utils/scope";
import type { RepositoryManager } from "~/repositories";
import type {
  EmbeddingMutationResult,
  EmbeddingProvider,
  EmbeddingQueryResult,
  EmbeddingVector,
  RagOptions,
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
  private repositories: RepositoryManager;

  constructor(config: VectorizeEmbeddingProviderConfig) {
    this.ai = config.ai;
    this.repositories = config.repositories;
    this.vector_db = config.vector_db;
  }

  async generate(
    type: string,
    content: string,
    id: string,
    metadata: Record<string, string>,
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
    options: RagOptions = {},
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
    queryVector: VectorFloatArray,
    options: RagOptions = {},
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
    const matches = await this.vector_db.query(queryVector, queryOptions);

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

  async searchSimilar(query: string, options: RagOptions = {}) {
    logger.debug("Searching for similar embeddings in Vectorize");
    const scopeTag = requireEmbeddingScopeTag(options);
    const queryVector = await this.getQuery(query);

    if (!queryVector.data) {
      throw new AssistantError("No embedding data found", ErrorType.NOT_FOUND);
    }

    const metadataFilter = buildVectorizeMetadataFilter(options);
    const queryOptions = {
      topK: options.topK ?? 15,
      returnValues: options.returnValues ?? false,
      returnMetadata: options.returnMetadata ?? "none",
      namespace: scopeTag,
      ...(metadataFilter && { filter: metadataFilter }),
    };
    const matches = await this.vector_db.query(queryVector.data[0], queryOptions);

    if (!matches.matches?.length) {
      throw new AssistantError("No matches found", ErrorType.NOT_FOUND);
    }

    const filteredMatches = matches.matches
      .filter((match) => match.score >= (options.scoreThreshold || 0))
      .slice(0, options.topK || 3);

    const matchesWithContent = await Promise.all(
      filteredMatches.map(async (match) => {
        if (!options.namespace || options.userId === undefined || options.userId === null) {
          throw new AssistantError(
            "Embedding search requires an authorised scope",
            ErrorType.PARAMS_ERROR,
          );
        }

        const record = await this.repositories.embeddings.getEmbedding(match.id, {
          type: getEmbeddingContentType(options),
          namespace: options.namespace,
          userId: options.userId,
        });

        if (!record) {
          return null;
        }

        return {
          match_id: match.id,
          id: record?.id as string,
          title: record?.title as string,
          content: record?.content as string,
          metadata: {
            ...match.metadata,
            ...(record?.metadata as Record<string, any>),
          },
          score: match.score || 0,
          type: (record?.type as string) || (match.metadata?.type as string),
        };
      }),
    );

    logger.debug("Vectorize search completed", { count: matchesWithContent.length });

    return matchesWithContent.filter(Boolean);
  }
}
