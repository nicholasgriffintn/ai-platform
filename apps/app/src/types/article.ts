import type { Output } from "@assistant/schemas";

interface VerifiedQuotes {
	verified: boolean;
	missingQuotes: string[];
}

interface GeneratedArticleContent {
	content: string;
	data?: Record<string, unknown>;
	citations?: string[];
	log_id?: string;
	model?: string;
	verifiedQuotes?: VerifiedQuotes;
}

export interface ArticleReportContent {
	title?: string;
	report?: GeneratedArticleContent;
	analysis?: GeneratedArticleContent;
	summary?: GeneratedArticleContent;
	originalArticle?: string;
	sourceItemIds?: string[];
}

export type ArticleReportItem = Omit<Output, "content"> & {
	content: ArticleReportContent;
};

export interface ArticleSessionSummary {
	groupId: string;
	id?: string;
	title: string;
	createdAt: string;
	sourceCount?: number;
	status: "processing" | "complete";
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
	status: "success";
	message?: string;
	outputId: string;
	itemId: string;
	analysis?: GeneratedArticleContent;
}

export interface SummariseArticleParams {
	article: string;
	itemId: string;
}

export interface SummariseArticleResponse {
	status: "success";
	message?: string;
	outputId: string;
	itemId: string;
	summary?: GeneratedArticleContent;
}

export interface GenerateReportParams {
	itemId: string;
}

export interface GenerateReportResponse {
	status: "success";
	message?: string;
	outputId: string;
	itemId: string;
}

export interface FetchMultipleArticlesResponse {
	articles: ArticleReportItem[];
}

export interface ArticlesResponse {
	articles: ArticleSessionSummary[];
}

export interface ArticleResponse {
	article: ArticleReportItem;
}

export interface ExtractArticleContentParams {
	urls: string[];
	extractDepth?: "basic" | "advanced";
	includeImages?: boolean;
}

export interface ExtractArticleContentResponse {
	status: "success" | "error";
	message?: string;
	data?: {
		content: string[];
		failedUrls: {
			url: string;
			error: string;
		}[];
	};
}
