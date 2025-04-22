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
}

export interface ArticleInput {
  id: string;
  text: string;
}
