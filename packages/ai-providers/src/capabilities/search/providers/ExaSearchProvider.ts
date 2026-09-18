import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ProviderKeyStore } from "../../../api-keys.js";
import type { ProviderEnv, ProviderUser } from "../../../env.js";
import type { ProviderRuntime } from "../../../runtime.js";
import type {
  ExaAnswerResult,
  ExaSearchResult,
  SearchOptions,
  SearchProvider,
  SearchResult,
} from "../../../types/index.js";
import { formatProviderError } from "../../../utils/errors.js";

export class ExaSearchProvider implements SearchProvider {
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
        const userApiKey = await this.keyStore.getProviderApiKey(this.user.id, "exa");

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

    const envKey = this.env.EXA_API_KEY;

    if (!envKey) {
      throw new AssistantError("EXA_API_KEY is not set", ErrorType.CONFIGURATION_ERROR);
    }

    this.apiKey = envKey;

    return envKey;
  }

  async performWebSearch(query: string, options?: SearchOptions): Promise<SearchResult> {
    const apiKey = await this.resolveApiKey();

    const payload = options?.include_answer
      ? {
          query,
          userLocation: options?.country,
          text: options?.include_raw_content ?? false,
          systemPrompt: options?.system_prompt || "",
        }
      : {
          query,
          type: "auto",
          userLocation: options?.country,
          numResults: options?.max_results || 5,
          contents: {
            text: options?.include_raw_content ?? false,
          },
        };

    const endpoint = options?.include_answer
      ? `https://api.exa.ai/answer`
      : `https://api.exa.ai/search`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return {
          status: "error",
          error: await formatProviderError(response, "Error performing web search"),
        };
      }

      const data = (await response.json()) as ExaSearchResult | ExaAnswerResult;

      if ("citations" in data) {
        return {
          ...data,
          provider: "exa",
          results: data.citations || [],
        };
      }

      return {
        provider: "exa",
        results: data.results || [],
      };
    } catch (error) {
      return {
        status: "error",
        error: await formatProviderError(error, "Error performing web search"),
      };
    }
  }
}
