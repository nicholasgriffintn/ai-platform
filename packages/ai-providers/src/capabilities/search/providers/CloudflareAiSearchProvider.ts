import { cloudflareAiSearchResponseSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ProviderEnv } from "../../../env.js";
import type { SearchOptions, SearchProvider, SearchResult } from "../../../types/search.js";
import {
  parseCloudflareSearchOptions,
  postCloudflareSearch,
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
        ...parsed.data.result,
        results: parsed.data.result.chunks.map((chunk) => ({
          ...chunk,
          title: chunk.item?.key ?? chunk.id,
          url: chunk.item?.key ?? "",
          snippet: chunk.text,
          chunkId: chunk.id,
        })),
      };
    } catch {
      return { status: "error", error: "Cloudflare AI Search is unavailable" };
    }
  }
}
