import type {
  IEnv,
  SearchOptions,
  SearchProvider,
  SearchResult,
  SerperSearchResult,
} from "../../types";

export class SerperProvider implements SearchProvider {
  private apiKey;

  constructor(env: IEnv) {
    this.apiKey = env.SERPER_API_KEY;
  }

  async performWebSearch(
    query: string,
    options?: SearchOptions,
  ): Promise<SearchResult> {
    if (!this.apiKey) {
      throw new Error("SERPER_API_KEY is not set");
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
        autocorrect: options?.autocorrect || true,
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
    return data;
  }
}
