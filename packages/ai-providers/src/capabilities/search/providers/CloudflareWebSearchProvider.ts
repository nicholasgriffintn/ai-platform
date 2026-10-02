import { cloudflareWebSearchResponseSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ProviderEnv } from "../../../env.js";
import { resolveAiGatewayId } from "../../../gateway.js";
import type { SearchOptions, SearchProvider, SearchResult } from "../../../types/search.js";
import {
  getCloudflareWebSearchSettings,
  parseCloudflareSearchOptions,
  postCloudflareSearch,
  readPublicSearchUrl,
  requireCloudflareSearchConfig,
} from "../../../utils/cloudflare-search.js";

export class CloudflareWebSearchProvider implements SearchProvider {
  constructor(private readonly env: ProviderEnv) {}

  async performWebSearch(query: string, options?: SearchOptions): Promise<SearchResult> {
    const accountId = requireCloudflareSearchConfig(this.env.ACCOUNT_ID, "ACCOUNT_ID");
    const token = this.env.CLOUDFLARE_WEB_SEARCH_TOKEN;

    if (!token) {
      throw new AssistantError(
        "CLOUDFLARE_WEB_SEARCH_TOKEN is required",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const input = parseCloudflareSearchOptions(query, options);
    const settings = getCloudflareWebSearchSettings(this.env, input);
    const limit = Math.min(input.max_results ?? input.num ?? 10, 10);

    try {
      const response = await postCloudflareSearch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/websearch/`,
        token,
        { query, ...settings, limit, options: { gateway: { id: resolveAiGatewayId() } } },
      );
      const parsed = cloudflareWebSearchResponseSchema.safeParse(response);

      if (!parsed.success) {
        return { status: "error", error: "Invalid Cloudflare web search response" };
      }

      return {
        provider: "cloudflare",
        searchProvider: settings.provider,
        requestId: parsed.data.metadata?.requestId,
        results: parsed.data.items
          .filter((item) => readPublicSearchUrl(item.url))
          .slice(0, limit)
          .map((item) => ({
            title: item.title,
            url: item.url,
            snippet: item.description ?? "",
          })),
      };
    } catch {
      return { status: "error", error: "Cloudflare web search is unavailable" };
    }
  }
}
