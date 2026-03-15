import { RepositoryManager } from "~/repositories";
import { getEmbeddingProvider } from "~/lib/providers/capabilities/embedding/helpers";
import type { IRequest } from "~/types";

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

interface TavilyExtractResult {
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
		extracted: TavilyExtractResult;
		vectorized?: {
			success: boolean;
			error?: string;
		};
	};
}

const CLOUDFLARE_TERMINAL_CRAWL_STATUSES = new Set([
	"completed",
	"cancelled_due_to_timeout",
	"cancelled_due_to_limits",
	"cancelled_by_user",
	"errored",
]);

type CloudflareFormat =
	| "markdown"
	| "content"
	| "json"
	| "links"
	| "scrape"
	| "snapshot";

type CloudflareCrawlRecord = {
	url: string;
	status: string;
	markdown?: string;
	html?: string;
	json?: unknown;
	links?: string[];
	metadata?: {
		status?: number;
		title?: string;
		url?: string;
		[key: string]: unknown;
	};
	error?: string;
};

type CloudflareCrawlResult = {
	id: string;
	status: string;
	browserSecondsUsed?: number;
	total?: number;
	finished?: number;
	records?: CloudflareCrawlRecord[];
	cursor?: string | number | null;
};

async function generateShortId(text: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(text);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return `tx_${hashArray
		.slice(0, 12)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")}`;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function toUrlList(urls: string | string[]): string[] {
	return Array.isArray(urls) ? urls : [urls];
}

function formatCloudflareValue(
	value: unknown,
	fallback = "No content returned by Cloudflare Browser Rendering",
): string {
	if (typeof value === "string") {
		return value;
	}

	if (Array.isArray(value)) {
		return value
			.map((entry) => {
				if (typeof entry === "string") {
					return entry;
				}
				return JSON.stringify(entry);
			})
			.join("\n");
	}

	if (value && typeof value === "object") {
		return JSON.stringify(value, null, 2);
	}

	return fallback;
}

function mapCloudflareResultToRawContent(
	format: CloudflareFormat,
	resultPayload: unknown,
): string {
	if (!resultPayload || typeof resultPayload !== "object") {
		return formatCloudflareValue(resultPayload);
	}

	const payload = resultPayload as Record<string, unknown>;

	if (format === "markdown") {
		return formatCloudflareValue(
			payload.markdown ?? payload.content ?? payload.html ?? resultPayload,
		);
	}

	if (format === "content" || format === "snapshot") {
		return formatCloudflareValue(
			payload.content ?? payload.html ?? payload.snapshot ?? resultPayload,
		);
	}

	if (format === "links") {
		return formatCloudflareValue(
			payload.links ?? payload.urls ?? resultPayload,
		);
	}

	if (format === "scrape") {
		const scraped = payload.result ?? payload.results ?? resultPayload;
		return formatCloudflareValue(scraped);
	}

	return formatCloudflareValue(payload.data ?? payload.json ?? resultPayload);
}

async function callCloudflareBrowserRendering({
	accountId,
	apiKey,
	path,
	body,
}: {
	accountId: string;
	apiKey: string;
	path: string;
	body: Record<string, unknown>;
}): Promise<unknown> {
	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/${path}`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(body),
		},
	);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(error);
	}

	const json = (await response.json()) as {
		result?: unknown;
	};
	return json.result ?? json;
}

async function fetchCloudflareCrawlStatus({
	accountId,
	apiKey,
	jobId,
	cursor,
	limit,
	status,
}: {
	accountId: string;
	apiKey: string;
	jobId: string;
	cursor?: string | number | null;
	limit?: number;
	status?: string;
}): Promise<CloudflareCrawlResult> {
	const params = new URLSearchParams();
	if (cursor !== undefined && cursor !== null) {
		params.set("cursor", String(cursor));
	}
	if (limit !== undefined) {
		params.set("limit", String(limit));
	}
	if (status) {
		params.set("status", status);
	}

	const suffix = params.size > 0 ? `?${params.toString()}` : "";
	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/crawl/${jobId}${suffix}`,
		{
			headers: {
				Authorization: `Bearer ${apiKey}`,
			},
		},
	);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(error);
	}

	const json = (await response.json()) as {
		result: CloudflareCrawlResult;
	};

	return json.result;
}

function mapCrawlRecordToExtractedResult(record: CloudflareCrawlRecord): {
	url: string;
	raw_content: string;
} {
	const rawContent =
		record.markdown ??
		record.html ??
		(record.json ? JSON.stringify(record.json, null, 2) : "") ??
		(record.links ? record.links.join("\n") : "");

	return {
		url: record.url,
		raw_content: rawContent || "No content returned",
	};
}

async function extractWithCloudflare(
	params: ContentExtractParams,
	req: IRequest,
): Promise<TavilyExtractResult> {
	if (!req.env.ACCOUNT_ID) {
		throw new Error("Cloudflare Account ID not configured");
	}

	if (!req.env.BROWSER_RENDERING_API_KEY) {
		throw new Error("Cloudflare Browser Rendering API key not configured");
	}

	const accountId = req.env.ACCOUNT_ID;
	const apiKey = req.env.BROWSER_RENDERING_API_KEY;
	const urls = toUrlList(params.urls);
	const format: CloudflareFormat = params.cloudflareFormat ?? "markdown";

	if (params.cloudflareCrawlOptions?.enabled) {
		const startUrl = urls[0];
		const crawlPayload: Record<string, unknown> = {
			url: startUrl,
		};

		const crawlOptions = params.cloudflareCrawlOptions;
		if (crawlOptions.limit !== undefined) {
			crawlPayload.limit = crawlOptions.limit;
		}
		if (crawlOptions.depth !== undefined) {
			crawlPayload.depth = crawlOptions.depth;
		}
		if (crawlOptions.source) {
			crawlPayload.source = crawlOptions.source;
		}
		if (crawlOptions.formats?.length) {
			crawlPayload.formats = crawlOptions.formats;
		}
		if (crawlOptions.render !== undefined) {
			crawlPayload.render = crawlOptions.render;
		}
		if (crawlOptions.maxAge !== undefined) {
			crawlPayload.maxAge = crawlOptions.maxAge;
		}
		if (crawlOptions.modifiedSince !== undefined) {
			crawlPayload.modifiedSince = crawlOptions.modifiedSince;
		}
		if (crawlOptions.options) {
			crawlPayload.options = crawlOptions.options;
		}

		const createResponse = (await callCloudflareBrowserRendering({
			accountId,
			apiKey,
			path: "crawl",
			body: crawlPayload,
		})) as string | { id?: string };

		const jobId =
			typeof createResponse === "string" ? createResponse : createResponse.id;

		if (!jobId) {
			throw new Error("Cloudflare crawl did not return a job ID");
		}

		const maxPollAttempts = crawlOptions.maxPollAttempts ?? 120;
		const pollIntervalMs = crawlOptions.pollIntervalMs ?? 5000;

		let finalResult: CloudflareCrawlResult | null = null;
		for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
			const statusResult = await fetchCloudflareCrawlStatus({
				accountId,
				apiKey,
				jobId,
				limit: 1,
			});

			if (CLOUDFLARE_TERMINAL_CRAWL_STATUSES.has(statusResult.status)) {
				finalResult = statusResult;
				break;
			}

			await sleep(pollIntervalMs);
		}

		if (!finalResult) {
			throw new Error("Cloudflare crawl job did not finish before timeout");
		}

		const allRecords: CloudflareCrawlRecord[] = [];
		let cursor: string | number | null | undefined = undefined;

		for (;;) {
			const page = await fetchCloudflareCrawlStatus({
				accountId,
				apiKey,
				jobId,
				cursor,
				limit: 1000,
			});

			if (page.records?.length) {
				allRecords.push(...page.records);
			}

			if (page.cursor === undefined || page.cursor === null) {
				break;
			}

			cursor = page.cursor;
		}

		const completedRecords = allRecords.filter(
			(record) => record.status === "completed",
		);
		const failedRecords = allRecords.filter(
			(record) => record.status !== "completed",
		);

		return {
			results: completedRecords.map(mapCrawlRecordToExtractedResult),
			failed_results: failedRecords.map((record) => ({
				url: record.url,
				error: record.error || `Cloudflare crawl status: ${record.status}`,
			})),
			response_time: finalResult.browserSecondsUsed ?? 0,
		};
	}

	const endpointPathByFormat: Record<CloudflareFormat, string> = {
		markdown: "markdown",
		content: "content",
		json: "json",
		links: "links",
		scrape: "scrape",
		snapshot: "snapshot",
	};

	const extractedResults: TavilyExtractResult["results"] = [];
	const failedResults: TavilyExtractResult["failed_results"] = [];

	for (const url of urls) {
		const requestBody: Record<string, unknown> = { url };

		if (format === "json" && params.cloudflareJsonOptions) {
			Object.assign(requestBody, params.cloudflareJsonOptions);
		}

		if (
			format === "scrape" &&
			params.cloudflareScrapeOptions?.elements?.length
		) {
			requestBody.elements = params.cloudflareScrapeOptions.elements;
		}

		try {
			const raw = await callCloudflareBrowserRendering({
				accountId,
				apiKey,
				path: endpointPathByFormat[format],
				body: requestBody,
			});

			extractedResults.push({
				url,
				raw_content: mapCloudflareResultToRawContent(format, raw),
			});
		} catch (error) {
			failedResults.push({
				url,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return {
		results: extractedResults,
		failed_results: failedResults,
		response_time: 0,
	};
}

function resolveProvider(params: ContentExtractParams, req: IRequest) {
	if (params.provider && params.provider !== "auto") {
		return params.provider;
	}

	if (req.env.TAVILY_API_KEY) {
		return "tavily";
	}

	if (req.env.BROWSER_RENDERING_API_KEY && req.env.ACCOUNT_ID) {
		return "cloudflare";
	}

	return "tavily";
}

export const extractContent = async (
	params: ContentExtractParams,
	req: IRequest,
): Promise<ContentExtractResult> => {
	try {
		const provider = resolveProvider(params, req);
		let data: TavilyExtractResult;

		if (provider === "cloudflare") {
			data = await extractWithCloudflare(params, req);
		} else {
			if (!req.env.TAVILY_API_KEY) {
				return {
					status: "error",
					error: "Tavily API key not configured",
				};
			}

			const response = await fetch("https://api.tavily.com/extract", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${req.env.TAVILY_API_KEY}`,
				},
				body: JSON.stringify({
					urls: params.urls,
					extract_depth: params.extract_depth || "basic",
					include_images: params.include_images || false,
				}),
			});

			if (!response.ok) {
				const error = await response.text();
				return {
					status: "error",
					error: `Error extracting content: ${error}`,
				};
			}

			data = (await response.json()) as TavilyExtractResult;
		}

		const result: ContentExtractResult = {
			status: "success",
			data: {
				extracted: data,
			},
		};

		if (params.should_vectorize && data.results.length > 0) {
			try {
				const repositories = new RepositoryManager(req.env);
				const userSettings = req.user?.id
					? await repositories.userSettings.getUserSettings(req.user.id)
					: null;
				const embedding = getEmbeddingProvider(req.env, req.user, userSettings);
				const vectors = await Promise.all(
					data.results.map(async (r) => {
						const id = await generateShortId(r.url);
						return embedding.generate("webpage", r.raw_content, id, {
							url: r.url,
							type: "webpage",
							source:
								provider === "cloudflare"
									? `cloudflare_${params.cloudflareCrawlOptions?.enabled ? "crawl" : (params.cloudflareFormat ?? "markdown")}`
									: "tavily_extract",
						});
					}),
				);

				const flatVectors = vectors.flat();
				if (flatVectors.length > 0) {
					const insertResult = await embedding.insert(flatVectors, {
						namespace: params.namespace || "webpages",
					});

					result.data!.vectorized = {
						success: insertResult.status === "success",
						error: insertResult.error || undefined,
					};
				}
			} catch (error) {
				result.data!.vectorized = {
					success: false,
					error: `Error vectorizing content: ${error}`,
				};
			}
		}

		return result;
	} catch (error) {
		return {
			status: "error",
			error: `Error extracting content: ${error}`,
		};
	}
};
