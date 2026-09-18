import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ProviderEnv } from "../../../env.js";
import type {
  SearchOptions,
  SearchProvider,
  SearchResult,
  SerperSearchResult,
} from "../../../types/index.js";

export class SerperProvider implements SearchProvider {
  private apiKey: string;
  private env: ProviderEnv;

  constructor(env: ProviderEnv) {
    this.env = env;

    if (!env.SERPER_API_KEY) {
      throw new AssistantError("SERPER_API_KEY is not set", ErrorType.CONFIGURATION_ERROR);
    }

    this.apiKey = env.SERPER_API_KEY;
  }

  async performWebSearch(query: string, options?: SearchOptions): Promise<SearchResult> {
    if (!this.apiKey) {
      throw new AssistantError("SERPER_API_KEY is not set", ErrorType.CONFIGURATION_ERROR);
    }

    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": this.apiKey,
      },
      body: JSON.stringify({
        q: query,
        gl: options?.country || "gb",
        location: options?.location,
        hl: options?.language || "en",
        tbs: options?.timePeriod,
        autocorrect: options?.autocorrect ?? true,
        num: options?.num || 10,
        page: options?.page || 1,
      }),
    });

    if (!response.ok) {
      const error = await response.text();

      return {
        status: "error",
        error: `Error performing web search: ${error}`,
      };
    }

    const data = (await response.json()) as SerperSearchResult;

    return {
      ...data,
      provider: "serper",
    };
  }
}
