import { cloudflareAiSearchResponseSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ProviderEnv } from "../../../env.js";
import type { SearchOptions, SearchProvider, SearchResult } from "../../../types/search.js";
import {
  getCloudflareAiSearchOrigins,
  parseCloudflareSearchOptions,
  postCloudflareSearch,
  readPublicSearchUrl,
  requireCloudflareSearchConfig,
} from "../../../utils/cloudflare-search.js";

export class CloudflareAiSearchProvider implements SearchProvider {
  constructor(private readonly env: ProviderEnv) {}

  async performWebSearch(query: string, options?: SearchOptions): Promise<SearchResult> {
    const accountId = requireCloudflareSearchConfig(this.env.ACCOUNT_ID, "ACCOUNT_ID");
    const namespace = requireCloudflareSearchConfig(
      this.env.CLOUDFLARE_AI_SEARCH_NAMESPACE ?? "default",
      "CLOUDFLARE_AI_SEARCH_NAMESPACE",
    );
    const instance = requireCloudflareSearchConfig(
      this.env.CLOUDFLARE_AI_SEARCH_INSTANCE,
      "CLOUDFLARE_AI_SEARCH_INSTANCE",
    );
    const token = this.env.CLOUDFLARE_AI_SEARCH_TOKEN;

    if (!token) {
      throw new AssistantError(
        "CLOUDFLARE_AI_SEARCH_TOKEN is required",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const origins = getCloudflareAiSearchOrigins(this.env.CLOUDFLARE_AI_SEARCH_ALLOWED_ORIGINS);
    const input = parseCloudflareSearchOptions(query, options);
    const limit = input.max_results ?? input.num ?? 10;

    try {
      const response = await postCloudflareSearch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai-search/namespaces/${namespace}/instances/${instance}/search`,
        token,
        {
          messages: [{ role: "user", content: query }],
          ai_search_options: {
            retrieval: {
              retrieval_type: input.retrieval_type ?? "hybrid",
              max_num_results: limit,
              filters: { is_public: true },
            },
          },
        },
      );
      const parsed = cloudflareAiSearchResponseSchema.safeParse(response);

      if (!parsed.success) {
        return { status: "error", error: "Invalid Cloudflare AI Search response" };
      }

      return {
        provider: "cloudflare-ai-search",
        results: parsed.data.result.chunks
          .flatMap((chunk) => {
            const url = chunk.item && readPublicSearchUrl(chunk.item.key);

            if (
              !url ||
              url.protocol !== "https:" ||
              !origins.has(url.origin) ||
              chunk.item?.metadata?.is_public !== true ||
              chunk.type !== "text"
            ) {
              return [];
            }

            return [
              {
                title: chunk.item.key,
                url: url.href,
                snippet: chunk.text,
                score: chunk.score,
                chunkId: chunk.id,
              },
            ];
          })
          .slice(0, limit),
      };
    } catch {
      return { status: "error", error: "Cloudflare AI Search is unavailable" };
    }
  }
}
