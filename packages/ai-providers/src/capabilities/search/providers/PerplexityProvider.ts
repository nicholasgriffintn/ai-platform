import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ProviderKeyStore } from "../../../api-keys.js";
import type { ProviderEnv, ProviderUser } from "../../../env.js";
import { resolveAiGatewayId } from "../../../gateway.js";
import type { ProviderRuntime } from "../../../runtime.js";
import type {
  PerplexitySearchResult,
  SearchOptions,
  SearchProvider,
  SearchResult,
} from "../../../types/index.js";
import { formatProviderError } from "../../../utils/errors.js";

type PerplexitySearchApiResponse = Omit<PerplexitySearchResult, "provider">;

export class PerplexityProvider implements SearchProvider {
  private env: ProviderEnv;
  private user?: ProviderUser;
  private apiKey?: string;
  private readonly keyStore?: ProviderKeyStore;

  constructor(env: ProviderEnv, user: ProviderUser | undefined, runtime: ProviderRuntime) {
    this.env = env;
    this.user = user;
    this.keyStore = user?.id ? runtime.host.keyStore(env) : undefined;
  }

  private async resolveApiKey(): Promise<string> {
    if (this.apiKey) {
      return this.apiKey;
    }

    if (this.user?.id && this.keyStore) {
      try {
        const userApiKey = await this.keyStore.getProviderApiKey(this.user.id, "perplexity-ai");

        if (userApiKey) {
          this.apiKey = userApiKey;

          return userApiKey;
        }
      } catch (error) {
        if (
          !(
            error instanceof AssistantError &&
            (error.type === ErrorType.NOT_FOUND || error.type === ErrorType.PARAMS_ERROR)
          )
        ) {
          throw error;
        }
      }
    }

    const envKey = this.env.PERPLEXITY_API_KEY;

    if (!envKey) {
      throw new AssistantError(
        "PERPLEXITY_API_KEY is not set",
        ErrorType.CONFIGURATION_ERROR,
        500,
        { provider: "perplexity" },
      );
    }

    this.apiKey = envKey;

    return envKey;
  }

  async performWebSearch(query: string, options?: SearchOptions): Promise<SearchResult> {
    const apiKey = await this.resolveApiKey();
    const requestBody: Record<string, unknown> = {
      query,
      max_results: options?.max_results || 10,
      max_tokens_per_page: 1024,
    };

    if (options?.country) {
      requestBody.country = options.country;
    }

    if (options?.language) {
      requestBody.search_language_filter = [options.language];
    }

    const endpoint = `https://gateway.ai.cloudflare.com/v1/${this.env.ACCOUNT_ID}/${resolveAiGatewayId()}/perplexity-ai/search`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      return {
        status: "error",
        error: await formatProviderError(response, "Error performing web search"),
      };
    }

    const data = (await response.json()) as PerplexitySearchApiResponse;

    const result: PerplexitySearchResult = {
      provider: "perplexity",
      results: Array.isArray(data.results) ? data.results : [],
      id: data.id,
      server_time: data.server_time,
    };

    return result;
  }
}
