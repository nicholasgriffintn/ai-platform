import type {
  Ai,
  D1Database,
  VectorFloatArray,
  Vectorize,
} from "@cloudflare/workers-types";

import { gatewayId } from "../../constants/app";
import type {
  EmbeddingMutationResult,
  EmbeddingProvider,
  EmbeddingQueryResult,
  EmbeddingVector,
  RagOptions,
} from "../../types";
import { AssistantError, ErrorType } from "../../utils/errors";
import { Database } from "../database";

export interface VectorizeEmbeddingProviderConfig {
  ai: Ai;
  vector_db: Vectorize;
  db: D1Database;
}

export class VectorizeEmbeddingProvider implements EmbeddingProvider {
  private ai: Ai;
  private vector_db: Vectorize;
  private db: D1Database;
  private topK = 15;
  private returnValues = false;
  private returnMetadata: "none" | "indexed" | "all" = "none";

  constructor(config: VectorizeEmbeddingProviderConfig) {
    this.ai = config.ai;
    this.db = config.db;
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

      const response = await this.ai.run(
        "@cf/baai/bge-base-en-v1.5",
        { text: [content] },
        {
          gateway: {
            id: gatewayId,
            skipCache: false,
            cacheTtl: 172800,
          },
        },
      );

      if (!response.data) {
        throw new AssistantError("No data returned from Vectorize API");
      }

      const mergedMetadata = { ...metadata, type };

      return response.data.map((vector: number[]) => ({
        id,
        values: vector,
        metadata: mergedMetadata,
      }));
    } catch (error) {
      console.error("Vectorize Embedding API error:", error);
      throw error;
    }
  }

  async insert(
    embeddings: EmbeddingVector[],
    options: RagOptions = {},
  ): Promise<EmbeddingMutationResult> {
    await this.vector_db.upsert(
      embeddings.map((embedding) => ({
        id: embedding.id,
        values: embedding.values,
        metadata: embedding.metadata,
        namespace: options.namespace || "assistant-embeddings",
      })),
    );
    return {
      status: "success",
      error: null,
    };
  }

  async delete(ids: string[]) {
    await this.vector_db.deleteByIds(ids);

    return {
      status: "success",
      error: null,
    };
  }

  async getQuery(
    query: string,
  ): Promise<{ data: any; status: { success: boolean } }> {
    const response = await this.ai.run(
      "@cf/baai/bge-base-en-v1.5",
      { text: [query] },
      {
        gateway: {
          id: gatewayId,
          skipCache: false,
          cacheTtl: 172800,
        },
      },
    );

    return {
      data: response.data,
      status: { success: true },
    };
  }

  async getMatches(
    queryVector: VectorFloatArray,
    options: RagOptions = {},
  ): Promise<EmbeddingQueryResult> {
    const matches = await this.vector_db.query(queryVector, {
      topK: this.topK,
      returnValues: this.returnValues,
      returnMetadata: this.returnMetadata,
      namespace: options.namespace || "assistant-embeddings",
    });

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
    const queryVector = await this.getQuery(query);

    if (!queryVector.data) {
      throw new AssistantError("No embedding data found", ErrorType.NOT_FOUND);
    }

    const matches = await this.vector_db.query(queryVector.data[0], {
      topK: this.topK,
      returnValues: this.returnValues,
      returnMetadata: this.returnMetadata,
      namespace: options.namespace || "assistant-embeddings",
    });

    if (!matches.matches?.length) {
      throw new AssistantError("No matches found", ErrorType.NOT_FOUND);
    }

    const filteredMatches = matches.matches
      .filter((match) => match.score >= (options.scoreThreshold || 0))
      .slice(0, options.topK || 3);

    const database = Database.getInstance(this.db);

    const matchesWithContent = await Promise.all(
      filteredMatches.map(async (match) => {
        const record = await database.getEmbedding(match.id, options.type);

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

    return matchesWithContent;
  }
}
