import type { ProviderEnv, ProviderUser } from "../../../env.js";
import type { ProviderRuntime } from "../../../runtime.js";
import type {
  GreenPtSearchResult,
  SearchOptions,
  SearchProvider,
  SearchResult,
} from "../../../types/index.js";
import { formatProviderError } from "../../../utils/errors.js";
import { greenPtJsonRequest, resolveGreenPtApiKey } from "../../../utils/greenpt.js";

const MAX_QUERY_LENGTH = 500;
const DEFAULT_RESULT_COUNT = 10;
const MAX_INDEX_RESULTS = 50;
const MAX_ENRICHED_RESULTS = 20;

interface GreenPtWebIndexResponse {
  results?: Array<{
    url?: string;
    title?: string;
    description?: string;
    position?: number;
    favicon?: string;
  }>;
}

interface GreenPtEnrichedSearchResponse {
  note?: string;
  results?: Array<{
    title?: string;
    link?: string;
    snippet?: string;
    relevant_content?: string;
  }>;
}

function clampCount(value: number | undefined, max: number): number {
  const count = value ?? DEFAULT_RESULT_COUNT;

  return Math.min(Math.max(Math.trunc(count), 1), max);
}

export function mapGreenPtIndexResults(data: GreenPtWebIndexResponse): GreenPtSearchResult {
  return {
    provider: "greenpt",
    results: (data.results ?? [])
      .filter((result) => typeof result.url === "string")
      .map((result) => ({
        title: result.title ?? "",
        url: result.url ?? "",
        snippet: result.description ?? "",
        position: result.position,
        favicon: result.favicon,
      })),
  };
}

export function mapGreenPtEnrichedResults(
  data: GreenPtEnrichedSearchResponse,
): GreenPtSearchResult {
  return {
    provider: "greenpt",
    note: data.note,
    results: (data.results ?? [])
      .filter((result) => typeof result.link === "string")
      .map((result, index) => ({
        title: result.title ?? "",
        url: result.link ?? "",
        snippet: result.snippet ?? "",
        position: index + 1,
        relevant_content: result.relevant_content,
      })),
  };
}

export class GreenPtSearchProvider implements SearchProvider {
  constructor(
    private readonly env: ProviderEnv,
    private readonly user: ProviderUser | undefined,
    private readonly runtime: ProviderRuntime,
  ) {}

  async performWebSearch(query: string, options?: SearchOptions): Promise<SearchResult> {
    try {
      const apiKey = await resolveGreenPtApiKey(this.runtime.host, {
        env: this.env,
        userId: this.user?.id,
      });
      const trimmedQuery = query.slice(0, MAX_QUERY_LENGTH);
      const language = options?.language ?? options?.country;
      const wantsEnrichment = options?.include_raw_content || options?.search_depth === "advanced";

      if (wantsEnrichment) {
        const data = await greenPtJsonRequest<GreenPtEnrichedSearchResponse>({
          apiKey,
          path: "/tools/websearch",
          label: "GreenPT web search",
          payload: {
            query: trimmedQuery,
            count: clampCount(options?.max_results ?? options?.num, MAX_ENRICHED_RESULTS),
            force_fetch: options?.include_raw_content ?? false,
            ...(language ? { language } : {}),
          },
        });

        return mapGreenPtEnrichedResults(data);
      }

      const data = await greenPtJsonRequest<GreenPtWebIndexResponse>({
        apiKey,
        path: "/tools/search/web",
        label: "GreenPT search",
        payload: {
          query: trimmedQuery,
          maxResults: clampCount(options?.max_results ?? options?.num, MAX_INDEX_RESULTS),
          ...(options?.page ? { page: Math.max(1, Math.trunc(options.page)) } : {}),
          ...(language ? { country: language } : {}),
        },
      });

      return mapGreenPtIndexResults(data);
    } catch (error) {
      return {
        status: "error",
        error: await formatProviderError(error, "Error performing web search"),
      };
    }
  }
}
