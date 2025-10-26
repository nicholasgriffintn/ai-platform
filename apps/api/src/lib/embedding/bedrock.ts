import { AwsClient } from "aws4fetch";

import { StorageService } from "~/lib/storage";
import { UserSettingsRepository } from "~/repositories/UserSettingsRepository";
import type {
  EmbeddingMutationResult,
  EmbeddingProvider,
  EmbeddingQueryResult,
  EmbeddingVector,
  IEnv,
  IUser,
  RagOptions,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { bufferToBase64 } from "~/utils/base64";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/embedding/bedrock" });

type RawFileMetadata = {
  base64Input?: string;
  sourceUrl?: string;
  storageKey?: string;
  fileName?: string;
  mimeType?: string;
};

type ResolvedFileMetadata = {
  base64Data: string;
  fileName: string;
  mimeType: string;
  sourceUrl?: string;
};

const FILE_METADATA_EXCLUDED_KEYS = new Set([
  "fileBase64",
  "file_base64",
  "base64",
  "data",
  "dataUrl",
  "data_url",
  "storageKey",
  "storage_key",
  "fileKey",
  "file_key",
]);

export interface BedrockEmbeddingProviderConfig {
  knowledgeBaseId: string;
  knowledgeBaseCustomDataSourceId?: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export class BedrockEmbeddingProvider implements EmbeddingProvider {
  private knowledgeBaseId: string;
  private knowledgeBaseCustomDataSourceId?: string;
  private region: string;
  private agentEndpoint: string;
  private agentRuntimeEndpoint: string;
  private env: IEnv;
  private user?: IUser;
  private defaultAccessKeyId: string;
  private defaultSecretAccessKey: string;
  private storageService?: StorageService;

  constructor(config: BedrockEmbeddingProviderConfig, env: IEnv, user?: IUser) {
    this.knowledgeBaseId = config.knowledgeBaseId;
    this.knowledgeBaseCustomDataSourceId =
      config.knowledgeBaseCustomDataSourceId;
    this.region = config.region || "us-east-1";
    this.agentEndpoint = `https://bedrock-agent.${this.region}.amazonaws.com`;
    this.agentRuntimeEndpoint = `https://bedrock-agent-runtime.${this.region}.amazonaws.com`;
    this.env = env;
    this.user = user;
    this.defaultAccessKeyId = config.accessKeyId || "";
    this.defaultSecretAccessKey = config.secretAccessKey || "";
  }

  private getStorageService(): StorageService | null {
    if (!this.env.ASSETS_BUCKET) {
      return null;
    }
    if (!this.storageService) {
      this.storageService = new StorageService(this.env.ASSETS_BUCKET);
    }
    return this.storageService;
  }

  private shouldOmitMetadataKey(key: string): boolean {
    return FILE_METADATA_EXCLUDED_KEYS.has(key);
  }

  private buildInlineAttributes(metadata: Record<string, any>) {
    return Object.entries(metadata)
      .filter(([key, value]) => {
        if (value === undefined || value === null) {
          return false;
        }
        return !this.shouldOmitMetadataKey(key);
      })
      .map(([key, value]) => ({
        key,
        value: {
          type: "STRING",
          stringValue:
            typeof value === "string" ? value : JSON.stringify(value ?? {}),
        },
      }));
  }

  private isAssetUrl(url: string): boolean {
    if (!url) {
      return false;
    }
    if (url.startsWith("data:")) {
      return true;
    }
    if (this.env.PUBLIC_ASSETS_URL && url.startsWith(this.env.PUBLIC_ASSETS_URL)) {
      return true;
    }
    return /\/uploads\//.test(url);
  }

  private extractKeyFromUrl(url: string): string | null {
    if (!url) {
      return null;
    }
    if (url.startsWith("data:")) {
      return null;
    }
    if (this.env.PUBLIC_ASSETS_URL && url.startsWith(this.env.PUBLIC_ASSETS_URL)) {
      const base = this.env.PUBLIC_ASSETS_URL.endsWith("/")
        ? this.env.PUBLIC_ASSETS_URL
        : `${this.env.PUBLIC_ASSETS_URL}/`;
      return url.slice(base.length);
    }
    try {
      const parsed = new URL(url);
      const key = parsed.pathname.startsWith("/")
        ? parsed.pathname.slice(1)
        : parsed.pathname;
      return key || null;
    } catch {
      return url.startsWith("/") ? url.slice(1) : url;
    }
  }

  private parseBase64Input(
    input: string,
  ): { base64: string; mimeType?: string } {
    if (!input.startsWith("data:")) {
      return { base64: input };
    }
    const match = input.match(/^data:([^;]+);base64,(.*)$/);
    if (!match) {
      return { base64: input };
    }
    const [, mimeType, data] = match;
    return { base64: data, mimeType };
  }

  private async downloadUrlAsBase64(
    url: string,
  ): Promise<{ base64: string; mimeType?: string }> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new AssistantError(
          `Failed to download file: ${response.status} ${response.statusText}`,
          ErrorType.NETWORK_ERROR,
        );
      }
      const arrayBuffer = await response.arrayBuffer();
      const mimeType = response.headers.get("content-type") || undefined;
      return { base64: bufferToBase64(arrayBuffer), mimeType };
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }
      throw new AssistantError(
        `Network error downloading file: ${error instanceof Error ? error.message : "Unknown error"}`,
        ErrorType.NETWORK_ERROR,
      );
    }
  }

  private extractRawFileMetadata(
    metadata: Record<string, any>,
  ): RawFileMetadata | null {
    const base64Input =
      typeof metadata.fileBase64 === "string"
        ? metadata.fileBase64
        : typeof metadata.file_base64 === "string"
          ? metadata.file_base64
          : typeof metadata.base64 === "string"
            ? metadata.base64
            : typeof metadata.data === "string"
              ? metadata.data
              : typeof metadata.dataUrl === "string"
                ? metadata.dataUrl
                : typeof metadata.data_url === "string"
                  ? metadata.data_url
                  : undefined;

    const url =
      typeof metadata.fileUrl === "string"
        ? metadata.fileUrl
        : typeof metadata.file_url === "string"
          ? metadata.file_url
          : typeof metadata.url === "string"
            ? metadata.url
            : undefined;

    const storageKey =
      typeof metadata.storageKey === "string"
        ? metadata.storageKey
        : typeof metadata.storage_key === "string"
          ? metadata.storage_key
          : typeof metadata.fileKey === "string"
            ? metadata.fileKey
            : typeof metadata.file_key === "string"
              ? metadata.file_key
              : undefined;

    const mimeType =
      typeof metadata.mimeType === "string"
        ? metadata.mimeType
        : typeof metadata.mime_type === "string"
          ? metadata.mime_type
          : typeof metadata.contentType === "string"
            ? metadata.contentType
            : typeof metadata.content_type === "string"
              ? metadata.content_type
              : typeof metadata.fileMimeType === "string"
                ? metadata.fileMimeType
                : undefined;

    const fileName =
      typeof metadata.fileName === "string"
        ? metadata.fileName
        : typeof metadata.file_name === "string"
          ? metadata.file_name
          : typeof metadata.name === "string"
            ? metadata.name
            : typeof metadata.title === "string"
              ? metadata.title
              : undefined;

    const hasFileSignal =
      !!base64Input ||
      !!storageKey ||
      (typeof url === "string" && this.isAssetUrl(url));

    if (!hasFileSignal) {
      return null;
    }

    return {
      base64Input,
      sourceUrl: url,
      storageKey,
      fileName,
      mimeType,
    };
  }

  private async resolveFileMetadata(
    raw: RawFileMetadata,
  ): Promise<ResolvedFileMetadata> {
    let base64Data = "";
    let mimeType = raw.mimeType;

    if (raw.base64Input) {
      const parsed = this.parseBase64Input(raw.base64Input);
      base64Data = parsed.base64;
      mimeType = mimeType || parsed.mimeType;
    } else if (raw.storageKey) {
      const storageService = this.getStorageService();
      if (!storageService) {
        throw new AssistantError(
          "ASSETS_BUCKET binding is required to retrieve uploaded files",
          ErrorType.CONFIGURATION_ERROR,
        );
      }
      const data = await storageService.getObject(raw.storageKey);
      if (!data) {
        throw new AssistantError(
          `Stored file not found for key ${raw.storageKey}`,
          ErrorType.NOT_FOUND,
        );
      }
      base64Data = data;
    } else if (raw.sourceUrl) {
      if (raw.sourceUrl.startsWith("data:")) {
        const parsed = this.parseBase64Input(raw.sourceUrl);
        base64Data = parsed.base64;
        mimeType = mimeType || parsed.mimeType;
      } else if (this.isAssetUrl(raw.sourceUrl)) {
        const key = this.extractKeyFromUrl(raw.sourceUrl);
        const storageService = this.getStorageService();
        if (!storageService) {
          throw new AssistantError(
            "ASSETS_BUCKET binding is required to retrieve uploaded files",
            ErrorType.CONFIGURATION_ERROR,
          );
        }
        if (!key) {
          throw new AssistantError(
            `Unable to resolve storage key from URL ${raw.sourceUrl}`,
            ErrorType.PARAMS_ERROR,
          );
        }
        const data = await storageService.getObject(key);
        if (!data) {
          throw new AssistantError(
            `Stored file not found for URL ${raw.sourceUrl}`,
            ErrorType.NOT_FOUND,
          );
        }
        base64Data = data;
      } else {
        const downloaded = await this.downloadUrlAsBase64(raw.sourceUrl);
        base64Data = downloaded.base64;
        mimeType = mimeType || downloaded.mimeType;
      }
    }

    if (!base64Data) {
      throw new AssistantError(
        "Unable to resolve binary payload for file embedding",
        ErrorType.PARAMS_ERROR,
      );
    }

    return {
      base64Data,
      mimeType: mimeType || "application/octet-stream",
      fileName: raw.fileName || "uploaded-document",
      sourceUrl: raw.sourceUrl,
    };
  }

  private parseAwsCredentials(apiKey: string): {
    accessKey: string;
    secretKey: string;
  } {
    const delimiter = "::@@::";
    const parts = apiKey.split(delimiter);

    if (parts.length !== 2) {
      throw new AssistantError(
        "Invalid AWS credentials format",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    return { accessKey: parts[0], secretKey: parts[1] };
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

      return [
        {
          id,
          values: [],
          metadata: { ...metadata, type, content },
        },
      ];
    } catch (error) {
      logger.error("Bedrock Embedding API error:", { error });
      throw error;
    }
  }

  async getAwsClient() {
    let accessKeyId = this.defaultAccessKeyId;
    let secretAccessKey = this.defaultSecretAccessKey;

    if (this.user?.id && this.env.DB) {
      try {
        const userSettingsRepo = new UserSettingsRepository(this.env);
        const userApiKey = await userSettingsRepo.getProviderApiKey(
          this.user.id,
          "bedrock",
        );

        if (userApiKey) {
          const credentials = this.parseAwsCredentials(userApiKey);
          accessKeyId = credentials.accessKey;
          secretAccessKey = credentials.secretKey;
        }
      } catch (error) {
        logger.warn("Failed to get user API key for bedrock:", { error });
      }
    }

    if (!accessKeyId || !secretAccessKey) {
      throw new AssistantError(
        "No valid credentials found",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const aws = new AwsClient({
      accessKeyId,
      secretAccessKey,
      region: this.region,
      service: "bedrock",
    });

    return aws;
  }

  async insert(
    embeddings: EmbeddingVector[],
    _options: RagOptions = {},
  ): Promise<EmbeddingMutationResult> {
    if (!this.knowledgeBaseCustomDataSourceId) {
      throw new AssistantError(
        "Bedrock knowledge base data source ID is not configured",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const url = `${this.agentEndpoint}/knowledgebases/${this.knowledgeBaseId}/datasources/${this.knowledgeBaseCustomDataSourceId}/documents`;
    const documents = await Promise.all(
      embeddings.map(async (embedding) => {
        const metadata = embedding.metadata || {};
        const rawFileMetadata = this.extractRawFileMetadata(metadata);
        const resolvedFile = rawFileMetadata
          ? await this.resolveFileMetadata(rawFileMetadata)
          : null;

        const inlineContent = resolvedFile
          ? {
              type: "BINARY",
              binaryContent: {
                data: resolvedFile.base64Data,
                mimeType: resolvedFile.mimeType,
                fileName: resolvedFile.fileName,
              },
            }
          : {
              type: "TEXT",
              textContent: {
                data: metadata.content || "",
              },
            };

        const inlineAttributes = this.buildInlineAttributes(metadata);

        return {
          content: {
            dataSourceType: "CUSTOM",
            custom: {
              customDocumentIdentifier: {
                id: embedding.id,
              },
              sourceType: "IN_LINE",
              inlineContent,
            },
          },
          metadata: {
            type: "IN_LINE_ATTRIBUTE",
            inlineAttributes,
          },
        };
      }),
    );

    const body = JSON.stringify({
      dataSourceId: this.knowledgeBaseCustomDataSourceId,
      documents,
    });

    const aws = await this.getAwsClient();
    const response = await aws.fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AssistantError(
        `Bedrock Knowledge Base API error: ${response.statusText} - ${errorText}`,
        ErrorType.PROVIDER_ERROR,
        response.status,
      );
    }

    let responseData: any = null;
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }

    const documentDetails = Array.isArray(responseData?.documentDetails)
      ? responseData.documentDetails
      : Array.isArray(responseData?.documents)
        ? responseData.documents
        : undefined;

    const documentIds = Array.isArray(documentDetails)
      ? documentDetails
          .map((detail: any) =>
            detail?.documentId ?? detail?.document?.documentId ?? detail?.id,
          )
          .filter((id: unknown): id is string => typeof id === "string")
      : undefined;

    return {
      status: "success",
      error: null,
      documentDetails,
      documentIds,
    };
  }

  async delete(
    _ids: string[],
  ): Promise<{ status: string; error: string | null }> {
    return {
      status: "error",
      error: "Not implemented",
    };
  }

  async getQuery(
    query: string,
  ): Promise<{ data: any; status: { success: boolean } }> {
    return {
      data: query,
      status: { success: true },
    };
  }

  async getMatches(
    queryVector: string,
    _options: RagOptions = {},
  ): Promise<EmbeddingQueryResult> {
    // TODO: look at other config: https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent-runtime_Retrieve.html
    const url = `${this.agentRuntimeEndpoint}/knowledgebases/${this.knowledgeBaseId}/retrieve`;

    const body = JSON.stringify({
      retrievalQuery: {
        text: queryVector,
      },
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
      const errorText = await response.text();
      throw new AssistantError(
        `Bedrock Knowledge Base API error: ${response.statusText} - ${errorText}`,
        ErrorType.PROVIDER_ERROR,
        response.status,
      );
    }

    const data = (await response.json()) as any;

    return {
      matches: data.retrievalResults.map((result: any) => ({
        title: result.title || "",
        content: result.content.text || "",
        id: result.location?.type || "",
        score: result.score || 0,
        metadata: {
          ...result.metadata,
          location: result.location,
        },
      })),
      count: data.retrievalResults.length,
    };
  }

  async searchSimilar(query: string, _options: RagOptions = {}) {
    const matchesResponse = await this.getMatches(query);

    if (!matchesResponse.matches.length) {
      throw new AssistantError("No matches found", ErrorType.NOT_FOUND);
    }

    return matchesResponse.matches.map((match) => ({
      title: match.title || match.metadata?.title || "",
      content: match.content || match.metadata?.content || "",
      metadata: match.metadata || {},
      score: match.score,
      type: match.metadata?.type || "text",
    }));
  }
}
