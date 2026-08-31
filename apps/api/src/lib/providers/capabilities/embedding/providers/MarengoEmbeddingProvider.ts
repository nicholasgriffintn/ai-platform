import type { Vectorize } from "@cloudflare/workers-types";

import { createServiceContext } from "~/lib/context/serviceContext";
import {
  requireEmbeddingScopeTag,
  withEmbeddingScopeMetadata,
} from "~/lib/providers/capabilities/embedding/utils/scope";
import { getModelConfig } from "~/lib/providers/models";
import type {
  EmbeddingMutationResult,
  EmbeddingProvider,
  EmbeddingQueryResult,
  EmbeddingVector,
  IEnv,
  IUser,
  RagOptions,
} from "~/types";
import { paginate } from "~/utils/arrays";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";
import { getLogger } from "~/utils/logger";

import { getChatProvider } from "../../chat";

const logger = getLogger({ prefix: "lib/embedding/marengo" });
const MAX_VECTORIZE_DELETE_IDS = 500;

export interface MarengoEmbeddingProviderConfig {
  vector_db: Vectorize;
}

interface MarengoResponse {
  embedding: number[];
  embeddingOption: any;
  startSec: number | null;
  endSec: number | null;
}

export class MarengoEmbeddingProvider implements EmbeddingProvider {
  private vector_db: Vectorize;
  private env: IEnv;
  private user?: IUser;

  constructor(config: MarengoEmbeddingProviderConfig, env: IEnv, user?: IUser) {
    this.vector_db = config.vector_db;
    this.env = env;
    this.user = user;
  }

  async generate(
    type: string,
    content: string,
    id: string,
    metadata: Record<string, any>,
  ): Promise<EmbeddingVector[]> {
    try {
      if (!type || !content || !id) {
        throw new AssistantError(
          "Missing type, content or id from request",
          ErrorType.PARAMS_ERROR,
        );
      }

      logger.debug("Generating embeddings with Marengo", { type });

      const marengoModelName = "marengo-embed";
      const marengoModelConfig = await getModelConfig(marengoModelName);
      const marengoProvider = getChatProvider(marengoModelConfig.provider, {
        env: this.env,
        user: this.user,
      });

      const requestContent: any[] = [{ type: "text", text: content }];

      if (metadata.url && type === "video") {
        requestContent.push({
          type: "video_url",
          video_url: { url: metadata.url },
        });
      }

      const response = await marengoProvider.getResponse(
        {
          model: marengoModelConfig.matchingModel,
          env: this.env,
          context: createServiceContext({ env: this.env, user: this.user }),
          messages: [
            {
              role: "user",
              content: requestContent,
            },
          ],
        },
        this.user?.id,
      );

      let marengoResponse: MarengoResponse;
      const responseData = response.response;

      if (typeof responseData === "string") {
        marengoResponse = safeParseJson(responseData);
        if (!marengoResponse) {
          throw new AssistantError(
            "Invalid JSON response from Marengo",
            ErrorType.EXTERNAL_API_ERROR,
          );
        }
      } else if (responseData && typeof responseData === "object") {
        marengoResponse = responseData as MarengoResponse;
      } else {
        throw new AssistantError(
          "Invalid response format from Marengo",
          ErrorType.EXTERNAL_API_ERROR,
        );
      }

      if (!marengoResponse.embedding || !Array.isArray(marengoResponse.embedding)) {
        throw new AssistantError(
          "Invalid embedding format from Marengo",
          ErrorType.EXTERNAL_API_ERROR,
        );
      }

      const mergedMetadata = {
        ...metadata,
        type,
      };

      logger.debug("Marengo embedding generation completed");

      return [
        {
          id,
          values: marengoResponse.embedding,
          metadata: mergedMetadata,
        },
      ];
    } catch (error) {
      logger.error("Marengo embedding generation failed");
      throw error instanceof AssistantError
        ? error
        : new AssistantError("Marengo embedding generation failed", ErrorType.EXTERNAL_API_ERROR);
    }
  }

  async insert(
    embeddings: EmbeddingVector[],
    options: RagOptions = {},
  ): Promise<EmbeddingMutationResult> {
    const scopeTag = requireEmbeddingScopeTag(options);

    try {
      logger.debug("Inserting embeddings into Marengo Vector DB", {
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

      logger.debug("Marengo Vector DB upsert response", {
        status: "success",
      });

      return {
        status: "success",
        error: null,
      };
    } catch {
      logger.error("Failed to insert Marengo embeddings");

      return {
        status: "error",
        error: "Marengo vector insert failed",
      };
    }
  }

  async delete(ids: string[]): Promise<EmbeddingMutationResult> {
    try {
      await Promise.all(
        paginate(ids, MAX_VECTORIZE_DELETE_IDS).map((page) => this.vector_db.deleteByIds(page)),
      );

      return {
        status: "success",
        error: null,
      };
    } catch {
      logger.error("Failed to delete Marengo embeddings");

      return {
        status: "error",
        error: "Marengo vector delete failed",
      };
    }
  }

  async getQuery(_query: string): Promise<{ data: any; status: { success: boolean } }> {
    throw new AssistantError(
      "Query operation not supported by Marengo provider",
      ErrorType.NOT_FOUND,
    );
  }

  async getMatches(_queryVector: any, _options: RagOptions = {}): Promise<EmbeddingQueryResult> {
    throw new AssistantError(
      "Match operation not supported by Marengo provider",
      ErrorType.NOT_FOUND,
    );
  }

  async searchSimilar(
    _query: string,
    _options?: RagOptions,
  ): Promise<
    {
      title: string;
      content: string;
      metadata: Record<string, any>;
      score: number;
      type: string;
    }[]
  > {
    throw new AssistantError(
      "Search operation not supported by Marengo provider",
      ErrorType.NOT_FOUND,
    );
  }
}
