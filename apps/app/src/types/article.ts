export interface ArticleReportItem {
  id: string;
  userId: number;
  appId: string;
  item_id?: string;
  item_type: "report";
  created_at: string;
  updated_at: string;
  title?: string;
  data: {
    title?: string;
    report?: {
      content: string;
      data: any;
      citations: string[];
      log_id: string;
      model: string;
      verifiedQuotes: {
        verified: boolean;
        missingQuotes: string[];
      };
    };
    sourceItemIds?: string[];
    sourceArticleCount?: number;
  };
  source_item_ids?: string[];
  source_article_count?: number;
  url?: string;
  content?: string;
  summary?: any;
  analysis?: any;
  reportStatus?: string;
  createdAt?: string;
}

export interface ArticleInput {
  id: string;
  text: string;
}

export interface AnalyseArticleParams {
  article: string;
  itemId: string;
}

export interface AnalyseArticleResponse {
  status: "success" | "error";
  message?: string;
  appDataId?: string;
  itemId?: string;
  analysis?: { content: string; data: any };
}

export interface SummariseArticleParams {
  article: string;
  itemId: string;
}

export interface SummariseArticleResponse {
  status: "success" | "error";
  message?: string;
  appDataId?: string;
  itemId?: string;
  summary?: { content: string; data: any };
}

export interface GenerateReportParams {
  itemId: string;
}

export interface GenerateReportResponse {
  status: "success" | "error";
  message?: string;
  appDataId?: string;
  itemId?: string;
}

export interface FetchMultipleArticlesResponse {
  status: "success" | "error";
  message?: string;
  articles?: ArticleReportItem[];
}

export interface ArticlesResponse {
  status: "success" | "error";
  message?: string;
  articles?: ArticleReportItem[];
}

export interface ArticleResponse {
  status: "success" | "error";
  message?: string;
  article?: ArticleReportItem;
}
