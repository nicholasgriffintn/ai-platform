import type {
  AiTextEmbeddingsOutput,
  VectorFloatArray,
  VectorizeAsyncMutation,
  VectorizeMatches,
  VectorizeVector,
} from "@cloudflare/workers-types";

import type { EmbeddingProvider, IEnv, RagOptions } from "../../types";
import { AssistantError } from "../../utils/errors";
import { trackRagMetrics } from "../monitoring";
import { EmbeddingProviderFactory } from "./factory";

export class Embedding {
  private static instance: Embedding;
  private provider: EmbeddingProvider;
  private env: IEnv;

  private constructor(env: IEnv) {
    this.env = env;

    if (env.EMBEDDING_PROVIDER === "bedrock") {
      if (
        !env.BEDROCK_AWS_ACCESS_KEY ||
        !env.BEDROCK_AWS_SECRET_KEY ||
        !env.BEDROCK_KNOWLEDGE_BASE_ID ||
        !env.BEDROCK_KNOWLEDGE_BASE_CUSTOM_DATA_SOURCE_ID
      ) {
        throw new AssistantError(
          "Missing required AWS credentials or knowledge base IDs",
        );
      }

      this.provider = EmbeddingProviderFactory.getProvider("bedrock", {
        knowledgeBaseId: this.env.BEDROCK_KNOWLEDGE_BASE_ID || "",
        knowledgeBaseCustomDataSourceId:
          this.env.BEDROCK_KNOWLEDGE_BASE_CUSTOM_DATA_SOURCE_ID || "",
        region: this.env.AWS_REGION || "us-east-1",
        accessKeyId: this.env.BEDROCK_AWS_ACCESS_KEY || "",
        secretAccessKey: this.env.BEDROCK_AWS_SECRET_KEY || "",
      });
    } else {
      this.provider = EmbeddingProviderFactory.getProvider("vectorize", {
        ai: this.env.AI,
        db: this.env.DB,
        vector_db: this.env.VECTOR_DB,
      });
    }
  }

  public static getInstance(env: IEnv): Embedding {
    if (!Embedding.instance) {
      Embedding.instance = new Embedding(env);
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
