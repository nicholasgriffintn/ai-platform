import { fetchProviderJson } from "@ngriffin_uk/polychat-ai-providers";
import { cloudflareAiSearchResponseSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { KnowledgeBaseHit, KnowledgeBaseProvider } from "../types";

export class CloudflareAiSearchKnowledgeProvider implements KnowledgeBaseProvider {
  readonly id = "cloudflare_ai_search";

  constructor(
    private readonly credentials: { token: string; accountId: string; instance: string },
  ) {}

  async search(query: string, limit: number): Promise<KnowledgeBaseHit[]> {
    const { token, accountId, instance } = this.credentials;
    const response = await fetchProviderJson<unknown>(
      this.id,
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai-search/namespaces/default/instances/${encodeURIComponent(instance)}/search`,
      {
        apiKey: token,
        body: {
          messages: [{ role: "user", content: query }],
          ai_search_options: {
            retrieval: { retrieval_type: "hybrid", max_num_results: limit },
          },
        },
      },
    );
    const parsed = cloudflareAiSearchResponseSchema.safeParse(response);

    if (!parsed.success) {
      throw new AssistantError(
        "Cloudflare AI Search returned an unexpected response",
        ErrorType.PROVIDER_ERROR,
        502,
      );
    }

    return parsed.data.result.chunks.map((chunk) => ({
      id: chunk.id,
      title: chunk.item?.key ?? chunk.id,
      content: chunk.text,
      url: chunk.item?.key?.startsWith("http") ? chunk.item.key : null,
      score: chunk.score,
    }));
  }
}
