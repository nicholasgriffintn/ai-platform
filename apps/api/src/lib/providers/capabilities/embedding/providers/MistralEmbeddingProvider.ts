import type { Vectorize } from "@cloudflare/workers-types";

import { createServiceContext } from "~/lib/context/serviceContext";
import {
  buildVectorizeMetadataFilter,
  requireEmbeddingScopeTag,
  withEmbeddingScopeMetadata,
} from "~/lib/providers/capabilities/embedding/utils/scope";
import { getModelConfig } from "~/lib/providers/models";
import type {
  EmbeddingMutationResult,
  EmbeddingProvider,
  EmbeddingQueryOptions,
  EmbeddingQueryResult,
  EmbeddingVector,
  EmbeddingWriteOptions,
  IEnv,
  IUser,
  NumericEmbeddingQuery,
} from "~/types";
import { paginate } from "~/utils/arrays";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";
import { getLogger } from "~/utils/logger";

import { getChatProvider } from "../../chat";

const logger = getLogger({ prefix: "lib/embedding/mistral" });
const MAX_VECTORIZE_DELETE_IDS = 500;

interface MistralProviderResponse {
  data: {
    object: string;
    index: number;
    embedding: number[] | Float32Array;
  }[];
}

export interface MistralEmbeddingProviderConfig {
  vector_db: Vectorize;
}

export class MistralEmbeddingProvider implements EmbeddingProvider {
  private vector_db: Vectorize;
  private env: IEnv;
  private user?: IUser;

  constructor(config: MistralEmbeddingProviderConfig, env: IEnv, user?: IUser) {
    this.vector_db = config.vector_db;
    this.env = env;
    this.user = user;
  }

  async fetchEmbedding(content: string, model: string) {
    const trimmedContent = content.trim();

    if (!trimmedContent.length) {
      throw new AssistantError("Empty content provided for embedding", ErrorType.PARAMS_ERROR);
    }

    logger.debug("Fetching embedding from Mistral", { model });

    const mistralModelConfig = await getModelConfig(model);
    const mistralProvider = getChatProvider(mistralModelConfig.provider, {
      env: this.env,
      user: this.user,
    });

    const response = await mistralProvider.getResponse(
      {
        model: mistralModelConfig.matchingModel,
        env: this.env,
        context: createServiceContext({ env: this.env, user: this.user }),
        body: {
          input: trimmedContent,
        },
      },
      this.user?.id,
    );

    let mistralResponse: MistralProviderResponse;
    const responseData = response;

    if (typeof responseData === "string") {
      mistralResponse = safeParseJson(responseData);
      if (!mistralResponse) {
        throw new AssistantError(
          "Invalid JSON response from Mistral",
          ErrorType.EXTERNAL_API_ERROR,
        );
      }
    } else if (responseData && typeof responseData === "object") {
      mistralResponse = responseData as MistralProviderResponse;
    } else {
      throw new AssistantError(
        "Invalid response format from Mistral",
        ErrorType.EXTERNAL_API_ERROR,
      );
    }

    if (!mistralResponse.data?.length || !Array.isArray(mistralResponse.data?.[0].embedding)) {
      throw new AssistantError(
        "Invalid embedding format from Mistral",
        ErrorType.EXTERNAL_API_ERROR,
      );
    }

    logger.debug("Mistral embedding generation completed");

    return mistralResponse;
  }

  async generate(
    type: string,
    content: string,
    id: string,
    metadata: Record<string, unknown>,
  ): Promise<EmbeddingVector[]> {
    if (!type || !content || !id) {
      throw new AssistantError("Missing type, content or id from request", ErrorType.PARAMS_ERROR);
    }

    logger.debug("Generating embeddings with Mistral", { type });

    const mistralModelName = type === "code" ? "codestral-embed" : "mistral-embed";
    const mistralResponse = await this.fetchEmbedding(content, mistralModelName);

    const mergedMetadata = {
      ...metadata,
      type,
      source: "mistral",
    };

    logger.debug("Mistral embedding generation completed");

    return [
      {
        id,
        values: mistralResponse.data[0].embedding,
        metadata: mergedMetadata,
      },
    ];
  }

  async insert(
    embeddings: EmbeddingVector[],
    options: EmbeddingWriteOptions = {},
  ): Promise<EmbeddingMutationResult> {
    const scopeTag = requireEmbeddingScopeTag(options);

    try {
      logger.debug("Inserting embeddings into Mistral Vector DB", {
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

      logger.debug("Mistral Vector DB upsert response", {
        status: "success",
      });

      return {
        status: "success",
        error: null,
      };
    } catch {
      logger.error("Failed to insert Mistral embeddings");

      return {
        status: "error",
        error: "Mistral vector insert failed",
      };
    }
  }

  async delete(ids: string[]): Promise<EmbeddingMutationResult> {
    try {
      logger.debug("Deleting embeddings from Mistral Vector DB", { count: ids.length });

      await Promise.all(
        paginate(ids, MAX_VECTORIZE_DELETE_IDS).map((page) => this.vector_db.deleteByIds(page)),
      );

      logger.debug("Mistral Vector DB delete response", { status: "success" });

      return {
        status: "success",
        error: null,
      };
    } catch {
      logger.error("Failed to delete Mistral embeddings");

      return {
        status: "error",
        error: "Mistral vector delete failed",
      };
    }
  }

  async getQuery(query: string): Promise<{ data: any; status: { success: boolean } }> {
    if (!query?.trim()) {
      throw new AssistantError(
        "Empty query provided for embeddings search",
        ErrorType.PARAMS_ERROR,
      );
    }

    const mistralModelName = "mistral-embed";
    const mistralResponse = await this.fetchEmbedding(query, mistralModelName);

    return {
      data: [mistralResponse.data[0].embedding],
      status: { success: true },
    };
  }

  async getMatches(
    queryVector: NumericEmbeddingQuery,
    options: EmbeddingQueryOptions = {},
  ): Promise<EmbeddingQueryResult> {
    logger.debug("Querying Mistral Vector DB");
    const scopeTag = requireEmbeddingScopeTag(options);

    const metadataFilter = buildVectorizeMetadataFilter(options);
    const queryOptions = {
      topK: options.topK ?? 15,
      returnValues: options.returnValues ?? false,
      returnMetadata: options.returnMetadata ?? "none",
      namespace: scopeTag,
      ...(metadataFilter && { filter: metadataFilter }),
    };
    const matches = await this.vector_db.query(Array.from(queryVector), queryOptions);

    logger.debug("Mistral Vector DB query completed", { count: matches.matches?.length || 0 });

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
