export interface WebScrapeTask {
  urls?: string[];
  search_query?: string;
  max_results?: number;
  extract_content?: boolean;
  languages?: string[];
  domain_filters?: {
    include?: string[];
    exclude?: string[];
  };
}
