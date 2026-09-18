import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ProviderKeyStore } from "../../../api-keys.js";
import type { ProviderEnv, ProviderUser } from "../../../env.js";
import {
  resolveAiGatewayId,
  getAiGatewayMetadataHeaders,
  resolveAiGatewayCacheTtl,
} from "../../../gateway.js";
import type { ProviderRuntime } from "../../../runtime.js";
import type {
  ParallelSearchResult,
  SearchOptions,
  SearchProvider,
  SearchResult,
} from "../../../types/index.js";
import { formatProviderError } from "../../../utils/errors.js";

export class ParallelSearchProvider implements SearchProvider {
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
        const userApiKey = await this.keyStore.getProviderApiKey(this.user.id, "parallel");

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

    const envKey = this.env.PARALLEL_API_KEY;

    if (!envKey) {
      throw new AssistantError("PARALLEL_API_KEY is not set", ErrorType.CONFIGURATION_ERROR);
    }

    this.apiKey = envKey;

    return envKey;
  }

  async performWebSearch(query: string, options?: SearchOptions): Promise<SearchResult> {
    if (!this.env.AI_GATEWAY_TOKEN) {
      throw new AssistantError("AI_GATEWAY_TOKEN is not set", ErrorType.CONFIGURATION_ERROR);
    }

    const apiKey = await this.resolveApiKey();
    const providedQueries = options?.parallel_search_queries;
    const searchQueries = providedQueries && providedQueries.length > 0 ? providedQueries : [query];
    const objective = options?.system_prompt || query;
    const payload = {
      objective,
      search_queries: searchQueries,
      processor: options?.parallel_processor || "base",
      max_results: options?.max_results ?? 10,
      max_chars_per_result: options?.parallel_max_chars_per_result ?? 6000,
    };

    const endpoint = `https://gateway.ai.cloudflare.com/v1/${this.env.ACCOUNT_ID}/${resolveAiGatewayId(this.env)}/parallel/v1beta/search`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "cf-aig-authorization": this.env.AI_GATEWAY_TOKEN,
          "cf-aig-metadata": JSON.stringify({
            ...getAiGatewayMetadataHeaders({ user: this.user }),
            provider: "parallel",
          }),
          "cf-aig-cache-ttl": resolveAiGatewayCacheTtl().toString(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return {
          status: "error",
          error: await formatProviderError(response, "Error performing web search"),
        };
      }

      const data = (await response.json()) as ParallelSearchResult;

      return {
        ...data,
        provider: "parallel",
      };
    } catch (error) {
      return {
        status: "error",
        error: await formatProviderError(error, "Error performing web search"),
      };
    }
  }
}
