export interface WebTask {
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

export interface WebSource {
  url: string;
  title: string;
  content?: string;
  excerpt?: string;
  author?: string;
  publishedAt?: string;
  scraped_at: string;
}

export interface WebContainerResponse {
  success: boolean;
  data?: {
    sources?: WebSource[];
    search_results?: Array<{
      title: string;
      url: string;
      snippet: string;
    }>;
  };
  error?: string;
  processing_time_ms: number;
}
