import type {
  AiTextEmbeddingsOutput,
  VectorFloatArray,
  VectorizeAsyncMutation,
  VectorizeMatches,
  VectorizeVector,
} from "@cloudflare/workers-types";

import type {
  EmbeddingProvider,
  IEnv,
  IUser,
  IUserSettings,
  RagOptions,
} from "../../types";
import { AssistantError } from "../../utils/errors";
import { Database } from "../database";
import { trackRagMetrics } from "../monitoring";
import { EmbeddingProviderFactory } from "./factory";

export class Embedding {
  private static instance: Embedding;
  private provider: EmbeddingProvider;
  private env: IEnv;
  private user?: IUser;

  private constructor(env: IEnv, user?: IUser, userSettings?: IUserSettings) {
    this.env = env;
    this.user = user;

    if (userSettings?.embedding_provider === "bedrock") {
      if (
        !userSettings.bedrock_knowledge_base_id ||
        !userSettings.bedrock_knowledge_base_custom_data_source_id
      ) {
        throw new AssistantError(
          "Missing required AWS credentials or knowledge base IDs",
        );
      }

      this.provider = EmbeddingProviderFactory.getProvider(
        "bedrock",
        {
          knowledgeBaseId: userSettings.bedrock_knowledge_base_id,
          knowledgeBaseCustomDataSourceId:
            userSettings.bedrock_knowledge_base_custom_data_source_id,
          region: this.env.AWS_REGION || "us-east-1",
          accessKeyId: this.env.BEDROCK_AWS_ACCESS_KEY || "",
          secretAccessKey: this.env.BEDROCK_AWS_SECRET_KEY || "",
        },
        this.env,
        this.user,
      );
    } else {
      const database = Database.getInstance(this.env);
      this.provider = EmbeddingProviderFactory.getProvider(
        "vectorize",
        {
          ai: this.env.AI,
          vector_db: this.env.VECTOR_DB,
          database,
        },
        this.env,
        this.user,
      );
    }
  }

  public static getInstance(
    env: IEnv,
    user?: IUser,
    userSettings?: IUserSettings,
  ): Embedding {
    if (!Embedding.instance) {
      Embedding.instance = new Embedding(env, user, userSettings);
    }
    return Embedding.instance;
  }

  async generate(
    type: string,
    content: string,
    id: string,
    metadata: Record<string, string>,
  ): Promise<VectorizeVector[]> {
    return await this.provider.generate(type, content, id, metadata);
  }

  async insert(
    embeddings: VectorizeVector[],
    options: RagOptions = {},
  ): Promise<VectorizeAsyncMutation> {
    // @ts-ignore
    return await this.provider.insert(embeddings, options);
  }

  async delete(
    ids: string[],
  ): Promise<{ status: string; error: string | null }> {
    return await this.provider.delete(ids);
  }

  async getQuery(query: string): Promise<AiTextEmbeddingsOutput> {
    // @ts-ignore
    return await this.provider.getQuery(query);
  }

  async getMatches(
    queryVector: VectorFloatArray,
    options: RagOptions = {},
  ): Promise<VectorizeMatches> {
    return await this.provider.getMatches(queryVector, options);
  }

  async searchSimilar(query: string, options?: RagOptions) {
    return await this.provider.searchSimilar(query, options);
  }

  async augmentPrompt(
    query: string,
    options?: RagOptions,
    env?: IEnv,
    userId?: number,
  ): Promise<string> {
    try {
      const relevantDocs = await trackRagMetrics(
        () =>
          this.searchSimilar(query, {
            topK: options?.topK || 3,
            scoreThreshold: options?.scoreThreshold || 0.7,
            type: options?.type || "note",
            namespace: options?.namespace || "assistant-embeddings",
          }),
        env?.ANALYTICS,
        { query, method: "augment_prompt_search" },
        userId,
      );

      if (!relevantDocs.length) {
        return query;
      }

      const shouldIncludeMetadata = options?.includeMetadata ?? true;
      const metadata = shouldIncludeMetadata
        ? { title: true, type: true, score: true }
        : {};

      const prompt = `
Context information is below.
---------------------
${relevantDocs
  .map((doc: any) => {
    const parts = [];
    if (metadata.type && doc.type) parts.push(`[${doc.type.toUpperCase()}]`);
    if (metadata.title && doc.title) parts.push(doc.title);

    return `
${parts.join(" ")}
${doc.content}
${metadata.score ? `Score: ${(doc.score * 100).toFixed(1)}%` : ""}
`.trim();
  })
  .join("\n\n")}
---------------------
Given the context information and not prior knowledge, answer the query: ${query}
    `.trim();

      return prompt;
    } catch (error) {
      console.error(error);
      return query;
    }
  }
}
