import type { Ai } from "@cloudflare/workers-types";
import { AwsClient } from "aws4fetch";

import { gatewayId } from "~/constants/app";
import { WORKERS_EMBEDDING_MODEL } from "~/lib/providers/capabilities/embedding/constants";
import {
  buildS3VectorsMetadataFilter,
  getEmbeddingCredentialFingerprint,
  requireEmbeddingScopeTag,
  withEmbeddingScopeMetadata,
} from "~/lib/providers/capabilities/embedding/utils/scope";
import { formatProviderError } from "~/lib/providers/utils/errors";
import { parseAwsCredentials } from "~/lib/providers/utils/helpers";
import { UserSettingsRepository } from "~/repositories/UserSettingsRepository";
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
import { parseEmbeddingVectors } from "~/utils/embeddings";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/embedding/s3vectors" });
const MAX_S3_VECTOR_DELETE_KEYS = 500;

export interface S3VectorsEmbeddingProviderConfig {
  bucketName: string;
  indexName?: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
  expectedCredentialFingerprint?: string;
  ai: Ai;
}

export class S3VectorsEmbeddingProvider implements EmbeddingProvider {
  private bucketName: string;
  private indexName?: string;
  private region: string;
  private endpoint: string;
  private env: IEnv;
  private user?: IUser;
  private defaultAccessKeyId: string;
  private defaultSecretAccessKey: string;
  private expectedCredentialFingerprint?: string;
  private ai: Ai;

  constructor(config: S3VectorsEmbeddingProviderConfig, env: IEnv, user?: IUser) {
    this.bucketName = config.bucketName;
    this.indexName = config.indexName;
    this.region = config.region || "us-east-1";
    this.endpoint = `https://s3vectors.${this.region}.api.aws`;
    this.env = env;
    this.user = user;
    this.defaultAccessKeyId = config.accessKeyId || "";
    this.defaultSecretAccessKey = config.secretAccessKey || "";
    this.expectedCredentialFingerprint = config.expectedCredentialFingerprint;
    this.ai = config.ai;
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

      logger.debug("Generating embeddings with S3 Vectors", { type });

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

      logger.debug("S3 Vectors embedding generation completed");

      return parseEmbeddingVectors(response, "No data returned from embedding model").map(
        (vector) => ({
          id,
          values: vector,
          metadata: { ...metadata, type },
        }),
      );
    } catch (error) {
      logger.error("S3 Vectors embedding generation failed");
      throw error;
    }
  }

  async getAwsClient() {
    if (this.user?.id) {
      if (!this.env.DB) {
        throw new AssistantError(
          "S3 Vectors user credentials are unavailable",
          ErrorType.CONFIGURATION_ERROR,
        );
      }

      try {
        const userSettingsRepo = new UserSettingsRepository(this.env);
        const userApiKey = await userSettingsRepo.getProviderApiKey(this.user.id, "s3vectors");

        if (!userApiKey) {
          throw new AssistantError(
            "S3 Vectors user credentials are not configured",
            ErrorType.CONFIGURATION_ERROR,
          );
        }

        const credentials = parseAwsCredentials(userApiKey);

        if (
          this.expectedCredentialFingerprint &&
          (await getEmbeddingCredentialFingerprint(this.env.EMBEDDING_SCOPE_SECRET, userApiKey)) !==
            this.expectedCredentialFingerprint
        ) {
          throw new AssistantError(
            "S3 Vectors credentials changed after the target was recorded",
            ErrorType.CONFIGURATION_ERROR,
          );
        }

        return new AwsClient({
          accessKeyId: credentials.accessKey,
          secretAccessKey: credentials.secretKey,
          region: this.region,
          service: "s3vectors",
        });
      } catch {
        logger.warn("Failed to load S3 Vectors credentials");
        throw new AssistantError(
          "S3 Vectors user credentials are invalid or unavailable",
          ErrorType.CONFIGURATION_ERROR,
        );
      }
    }

    const accessKeyId = this.defaultAccessKeyId;
    const secretAccessKey = this.defaultSecretAccessKey;

    if (!accessKeyId || !secretAccessKey) {
      throw new AssistantError("No valid credentials found", ErrorType.CONFIGURATION_ERROR);
    }

    const aws = new AwsClient({
      accessKeyId,
      secretAccessKey,
      region: this.region,
      service: "s3vectors",
    });

    return aws;
  }

  async insert(
    embeddings: EmbeddingVector[],
    options: EmbeddingWriteOptions = {},
  ): Promise<EmbeddingMutationResult> {
    requireEmbeddingScopeTag(options);
    logger.debug("Inserting embeddings into S3 Vectors", {
      count: embeddings.length,
    });

    const url = `${this.endpoint}/PutVectors`;

    const vectors = embeddings.map((embedding) => ({
      key: embedding.id,
      data: {
        float32: embedding.values,
      },
      metadata: withEmbeddingScopeMetadata(embedding.metadata, options),
    }));

    const body = JSON.stringify({
      vectorBucketName: this.bucketName,
      indexName: this.indexName,
      vectors,
    });

    const aws = await this.getAwsClient();
    const response = await aws.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });

    if (!response.ok) {
      throw new AssistantError(
        await formatProviderError(response, "S3 Vectors API error"),
        ErrorType.PROVIDER_ERROR,
        response.status,
      );
    }

    logger.debug("S3 Vectors insert response", { status: "success" });

    return {
      status: "success",
      error: null,
    };
  }

  async delete(ids: string[]): Promise<{ status: string; error: string | null }> {
    try {
      logger.debug("Deleting embeddings from S3 Vectors", { count: ids.length });
      const url = `${this.endpoint}/DeleteVectors`;
      const aws = await this.getAwsClient();

      await Promise.all(
        paginate(ids, MAX_S3_VECTOR_DELETE_KEYS).map(async (keys) => {
          const response = await aws.fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              vectorBucketName: this.bucketName,
              indexName: this.indexName,
              keys,
            }),
          });

          if (!response.ok) {
            throw new AssistantError(
              await formatProviderError(response, "S3 Vectors API error"),
              ErrorType.PROVIDER_ERROR,
              response.status,
            );
          }
        }),
      );

      logger.debug("S3 Vectors delete response", { status: "success" });

      return {
        status: "success",
        error: null,
      };
    } catch {
      logger.error("S3 Vectors delete failed");

      return {
        status: "error",
        error: "S3 Vectors delete failed",
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

    logger.debug("Generating query embedding with S3 Vectors");

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

    const vectors = parseEmbeddingVectors(response, "No data returned from embedding model");

    logger.debug("S3 Vectors query embedding result");

    return {
      data: vectors,
      status: { success: true },
    };
  }

  async getMatches(
    queryVector: NumericEmbeddingQuery,
    options: EmbeddingQueryOptions = {},
  ): Promise<EmbeddingQueryResult> {
    requireEmbeddingScopeTag(options);
    logger.debug("Querying S3 Vectors");
    const url = `${this.endpoint}/QueryVectors`;
    const float32 = Array.from(queryVector);

    if (float32.length === 0 || float32.some((value) => !Number.isFinite(value))) {
      throw new AssistantError("Invalid query vector", ErrorType.PARAMS_ERROR, 400);
    }

    const request: Record<string, any> = {
      vectorBucketName: this.bucketName,
      topK: options.topK ?? 15,
      returnDistance: true,
      returnMetadata: options.returnMetadata !== undefined && options.returnMetadata !== "none",
      queryVector: {
        float32,
      },
    };

    if (this.indexName) {
      request.indexName = this.indexName;
    }

    const metadataFilter = buildS3VectorsMetadataFilter(options);

    if (metadataFilter) {
      request.filter = metadataFilter;
    }

    const body = JSON.stringify(request);

    const aws = await this.getAwsClient();
    const response = await aws.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });

    if (!response.ok) {
      throw new AssistantError(
        await formatProviderError(response, "S3 Vectors API error"),
        ErrorType.PROVIDER_ERROR,
        response.status,
      );
    }

    const data = (await response.json()) as any;

    logger.debug("S3 Vectors query completed", { count: data.vectors?.length || 0 });

    return {
      matches:
        data.vectors?.map((vector: any) => ({
          id: vector.key,
          score: 1 - (vector.distance || 0),
          title: vector.metadata?.title || "",
          content: vector.metadata?.content || "",
          metadata: vector.metadata || {},
        })) || [],
      count: data.vectors?.length || 0,
    };
  }
}
