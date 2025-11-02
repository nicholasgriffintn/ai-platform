export type SearchProviderName =
  | "serper"
  | "tavily"
  | "parallel"
  | "duckduckgo"
  | "perplexity";

export interface SerperSearchResult {
  provider: "serper";
  searchParameters: Record<string, string>;
  knowledgeGraph: {
    title: string;
    type: string;
    website: string;
    imageUrl: string;
    description: string;
    descriptionSource: string;
    descriptionLink: string;
    attributes: Record<string, string>;
  };
  organic: {
    title: string;
    link: string;
    snippet: string;
    siteLinks: {
      title: string;
      link: string;
    }[];
    position: number;
    date?: string;
    attributes?: Record<string, string>;
  }[];
  peopleAlsoAsk: {
    question: string;
    snippet: string;
    title: string;
    link: string;
  }[];
  relatedSearches: {
    query: string;
  };
}

export interface TavilySearchResult {
  provider: "tavily";
  results: Array<{
    title: string;
    content: string;
    url: string;
    score: number;
  }>;
  answer?: string;
  images?: Array<{
    url: string;
  }>;
}

export interface ParallelSearchResult {
  provider: "parallel";
  search_id?: string;
  results: Array<{
    title?: string;
    url?: string;
    excerpts?: string[];
  }>;
}

export interface DuckDuckGoSearchResult {
  results: Array<{
    title: string;
    url: string;
    content: string;
    excerpts: string[];
    icon?: string;
    score?: number;
  }>;
  answer?: string;
  raw?: Record<string, unknown>;
}

export interface PerplexitySearchResult {
  provider: "perplexity";
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    date?: string;
    last_updated?: string;
  }>;
  id?: string;
}

export interface SearchResultError {
  status: "error";
  error: string;
}

export type SearchResult =
  | SerperSearchResult
  | TavilySearchResult
  | ParallelSearchResult
  | DuckDuckGoSearchResult
  | PerplexitySearchResult
  | SearchResultError;

export interface SearchProvider {
  performWebSearch(
    query: string,
    options?: SearchOptions,
  ): Promise<SearchResult>;
}

export interface SearchOptions {
  search_depth?: "basic" | "advanced";
  include_answer?: boolean;
  include_raw_content?: boolean;
  include_images?: boolean;
  max_results?: number;
  country?: string;
  location?: string;
  language?: string;
  timePeriod?: string;
  autocorrect?: boolean;
  num?: number;
  page?: number;
  parallel_objective?: string;
  parallel_search_queries?: string[];
  parallel_processor?: string;
  parallel_max_chars_per_result?: number;
}
