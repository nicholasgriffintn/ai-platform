import { AwsClient } from "aws4fetch";
import { UserSettingsRepository } from "../../repositories/UserSettingsRepository";
import type {
  EmbeddingMutationResult,
  EmbeddingProvider,
  EmbeddingQueryResult,
  EmbeddingVector,
  IEnv,
  IUser,
  RagOptions,
} from "../../types";
import { AssistantError, ErrorType } from "../../utils/errors";

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
      console.error("Bedrock Embedding API error:", error);
      throw error;
    }
  }

  async getAwsClient() {
    let accessKeyId = this.defaultAccessKeyId;
    let secretAccessKey = this.defaultSecretAccessKey;

    // Try to get user credentials if available
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
        console.warn("Failed to get user API key for bedrock:", error);
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
    options: RagOptions = {},
  ): Promise<EmbeddingMutationResult> {
    const url = `${this.agentEndpoint}/knowledgebases/${this.knowledgeBaseId}/datasources/${this.knowledgeBaseCustomDataSourceId}/documents`;

    // TODO: Support file uploads: https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent_IngestKnowledgeBaseDocuments.html
    const body = JSON.stringify({
      documents: embeddings.map((embedding) => ({
        content: {
          dataSourceType: "CUSTOM",
          custom: {
            customDocumentIdentifier: {
              id: embedding.id,
            },
            sourceType: "IN_LINE",
            inlineContent: {
              type: "TEXT",
              textContent: {
                data: embedding.metadata.content || "",
              },
            },
          },
        },
        metadata: {
          type: "IN_LINE_ATTRIBUTE",
          inlineAttributes: Object.keys(embedding.metadata).map((key) => ({
            key,
            value: {
              type: "STRING",
              stringValue: embedding.metadata[key],
            },
          })),
        },
      })),
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

    return {
      status: "success",
      error: null,
    };
  }

  async delete(
    ids: string[],
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
    options: RagOptions = {},
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

  async searchSimilar(query: string, options: RagOptions = {}) {
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
