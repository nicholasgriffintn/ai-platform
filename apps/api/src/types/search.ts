export type SearchProviderName = "serper" | "tavily";

export interface SerperSearchResult {
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

export interface SearchResultError {
  status: "error";
  error: string;
}

export type SearchResult =
  | SerperSearchResult
  | TavilySearchResult
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
}
