import type { Ai } from "@cloudflare/workers-types";
import { resolveAiGatewayId } from "@ngriffin_uk/polychat-ai-providers";
import { parseEmbeddingVectors } from "@ngriffin_uk/polychat-utility-server/embeddings";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { WORKERS_EMBEDDING_MODEL } from "~/config/storage";
import type { Embedder, EmbeddingMetadata } from "~/types";

export class WorkersEmbedder implements Embedder {
  constructor(private ai: Ai) {}

  private async embed(content: string): Promise<number[][]> {
    if (!content.trim()) {
      throw new AssistantError("Embedding content must not be empty", ErrorType.PARAMS_ERROR, 400);
    }

    const response = await this.ai.run(
      WORKERS_EMBEDDING_MODEL,
      { text: [content] },
      { gateway: { id: resolveAiGatewayId(), skipCache: false, cacheTtl: 259200 } },
    );

    return parseEmbeddingVectors(response, "No data returned from embedding model");
  }

  async generate(type: string, content: string, id: string, metadata: EmbeddingMetadata) {
    if (!type || !id) {
      throw new AssistantError("Embedding type and ID are required", ErrorType.PARAMS_ERROR, 400);
    }

    return (await this.embed(content)).map((values) => ({
      id,
      values,
      metadata: { ...metadata, type },
    }));
  }

  async getQuery(query: string) {
    return { data: await this.embed(query), status: { success: true } };
  }
}
