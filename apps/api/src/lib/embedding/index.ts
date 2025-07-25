import type {
  AiTextEmbeddingsOutput,
  VectorFloatArray,
  VectorizeAsyncMutation,
  VectorizeMatches,
  VectorizeVector,
} from "@cloudflare/workers-types";

import { Database } from "~/lib/database";
import { getAuxiliaryModel } from "~/lib/models";
import { trackRagMetrics } from "~/lib/monitoring";
import { AIProviderFactory } from "~/lib/providers/factory";
import type {
  EmbeddingProvider,
  IEnv,
  IUser,
  IUserSettings,
  RagOptions,
} from "~/types";
import { AssistantError } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { EmbeddingProviderFactory } from "./factory";

const logger = getLogger({ prefix: "EMBEDDING" });

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
      logger.debug("Using Bedrock embedding provider", {
        knowledgeBaseId: userSettings.bedrock_knowledge_base_id,
        region: this.env.AWS_REGION || "us-east-1",
      });
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
      logger.debug("Using Vectorize embedding provider", {
        ai: this.env.AI,
        vectorDb: this.env.VECTOR_DB,
      });
    }
  }

  public getNamespace(options?: RagOptions): string {
    if (options?.namespace) {
      if (
        this.user?.id &&
        (options.namespace.startsWith("user_kb_") ||
          options.namespace.startsWith("memory_user_")) &&
        !options.namespace.endsWith(this.user.id.toString())
      ) {
        return "kb";
      }
      return options.namespace;
    }

    if (this.user?.id) {
      return `user_kb_${this.user.id}`;
    }

    return "kb";
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
    logger.debug("generate called", {
      type,
      id,
      contentLength: content.length,
      metadata,
    });
    return await this.provider.generate(type, content, id, metadata);
  }

  async insert(
    embeddings: VectorizeVector[],
    options: RagOptions = {},
  ): Promise<VectorizeAsyncMutation> {
    logger.debug("insert called", { count: embeddings.length, options });
    const namespace = this.getNamespace(options);
    const opts = { ...options, namespace };
    // @ts-ignore
    return await this.provider.insert(embeddings, opts);
  }

  async delete(
    ids: string[],
  ): Promise<{ status: string; error: string | null }> {
    logger.debug("delete called", { ids });
    return await this.provider.delete(ids);
  }

  async getQuery(query: string): Promise<AiTextEmbeddingsOutput> {
    logger.debug("getQuery called", { query });
    // @ts-ignore
    return await this.provider.getQuery(query);
  }

  async getMatches(
    queryVector: VectorFloatArray,
    options: RagOptions = {},
  ): Promise<VectorizeMatches> {
    logger.debug("getMatches called", { length: queryVector.length, options });
    const namespace = this.getNamespace(options);
    return await this.provider.getMatches(queryVector, {
      ...options,
      namespace,
    });
  }

  async searchSimilar(query: string, options?: RagOptions) {
    logger.debug("searchSimilar called", { query, options });
    const namespace = this.getNamespace(options);
    return await this.provider.searchSimilar(query, { ...options, namespace });
  }

  async augmentPrompt(
    query: string,
    options?: RagOptions,
    env?: IEnv,
    userId?: number,
  ): Promise<string> {
    logger.debug("augmentPrompt called", { query, options, userId });
    try {
      const topK = options?.topK ?? (query.length < 20 ? 1 : 3);
      const scoreThreshold = options?.scoreThreshold ?? 0.7;
      const candidateCount = (options as any).rerankCandidates ?? 10;

      const namespace = this.getNamespace(options);
      const docs = await trackRagMetrics(
        () =>
          this.searchSimilar(query, {
            topK: candidateCount,
            scoreThreshold,
            type: options?.type,
            namespace,
          }),
        env?.ANALYTICS,
        { query, method: "augment_prompt_search" },
        userId,
      );
      logger.debug("augmentPrompt retrieved docs", {
        docsCount: docs.length,
        query,
        options,
        userId,
      });

      if (!docs.length) {
        return query;
      }

      let ranked = docs;
      if (docs.length > topK) {
        try {
          const reranker = AIProviderFactory.getProvider("workers");
          const rerankPrompt = `Rerank the following contexts by relevance to the query "${query}". Return a JSON array of IDs in descending order of relevance.\n${JSON.stringify(
            docs.map((d) => ({ id: d.id, content: d.content })),
            null,
            2,
          )}`;
          logger.debug("augmentPrompt reranking", { rerankPrompt });
          const rerankRes: any = await reranker.getResponse({
            env: env!,
            model: "bge-reranker-base",
            messages: [{ role: "user", content: rerankPrompt }],
            user: this.user,
          } as any);
          let order: string[];
          try {
            order = JSON.parse(rerankRes.content || rerankRes.response);
          } catch (e) {
            logger.error("Failed to parse rerank response", { error: e });
            order = [];
          }
          ranked = order
            .map((id) => docs.find((d) => d.id === id))
            .filter(Boolean) as any;
          logger.debug("augmentPrompt reranked", { ranked });
        } catch (e) {
          logger.warn("Reranking failed, falling back to dense scores", {
            error: e,
          });
        }
      }

      const selected = ranked.slice(0, topK);
      logger.debug("augmentPrompt selected", { selected });

      const summaryThreshold = options?.summaryThreshold ?? 750;
      for (const doc of selected) {
        if (doc.content.length > summaryThreshold) {
          try {
            const { model: modelToUse, provider: providerToUse } =
              await getAuxiliaryModel(env!, this.user);
            const summarizer = AIProviderFactory.getProvider(providerToUse);
            const sumPrompt = `Summarize the following context into a concise paragraph (no more than 100 words):\n\n${doc.content}`;
            const sumRes: any = await summarizer.getResponse({
              env: env!,
              model: modelToUse,
              messages: [{ role: "user", content: sumPrompt }],
              user: this.user,
            } as any);
            doc.content = sumRes.content || sumRes.response;
            logger.debug("augmentPrompt summarized", { doc });
          } catch (e) {
            logger.warn("Context summarization failed, using full content", {
              error: e,
            });
          }
        }
      }

      const contexts = selected.map((doc) => ({
        id: doc.id,
        type: doc.type,
        title: doc.title,
        score: doc.score,
        content: doc.content,
      }));

      const prompt = `
Contexts (JSON array):
+---------------------
${JSON.stringify(contexts, null, 2)}
+---------------------
Answer the query "${query}" using *only* these contexts.
`.trim();
      logger.debug("augmentPrompt prompt", { prompt });

      return prompt;
    } catch (error) {
      logger.error("Error augmenting prompt", { error });
      return query;
    }
  }
}
