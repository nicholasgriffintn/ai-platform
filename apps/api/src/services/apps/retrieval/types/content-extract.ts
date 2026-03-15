export interface ContentExtractParams {
	urls: string | string[];
	extract_depth?: "basic" | "advanced";
	include_images?: boolean;
	should_vectorize?: boolean;
	namespace?: string;
	provider?: "auto" | "tavily" | "cloudflare";
	cloudflareFormat?:
		| "markdown"
		| "content"
		| "json"
		| "links"
		| "scrape"
		| "snapshot";
	cloudflareJsonOptions?: Record<string, unknown>;
	cloudflareScrapeOptions?: {
		elements: Array<{
			selector: string;
			name?: string;
			attribute?: string;
		}>;
	};
	cloudflareCrawlOptions?: {
		enabled?: boolean;
		limit?: number;
		depth?: number;
		source?: "all" | "sitemaps" | "links";
		formats?: Array<"html" | "markdown" | "json">;
		render?: boolean;
		maxAge?: number;
		modifiedSince?: number;
		options?: {
			includeExternalLinks?: boolean;
			includeSubdomains?: boolean;
			includePatterns?: string[];
			excludePatterns?: string[];
		};
		pollIntervalMs?: number;
		maxPollAttempts?: number;
	};
}

export interface ExtractedContentPayload {
	results: Array<{
		url: string;
		raw_content: string;
		images?: string[];
	}>;
	failed_results: Array<{
		url: string;
		error: string;
	}>;
	response_time: number;
}

export interface ContentExtractResult {
	status: "success" | "error";
	error?: string;
	data?: {
		extracted: ExtractedContentPayload;
		vectorized?: {
			success: boolean;
			error?: string;
		};
	};
}

export type ContentExtractProvider = "tavily" | "cloudflare";
