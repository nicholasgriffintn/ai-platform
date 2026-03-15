import type { IRequest } from "~/types";

import type {
	ContentExtractParams,
	ExtractedContentPayload,
} from "../../types/content-extract";

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
	error?: string;
};

type CloudflareCrawlResult = {
	status: string;
	browserSecondsUsed?: number;
	records?: CloudflareCrawlRecord[];
	cursor?: string | number | null;
};

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
			.map((entry) =>
				typeof entry === "string" ? entry : JSON.stringify(entry),
			)
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
		return formatCloudflareValue(
			payload.result ?? payload.results ?? resultPayload,
		);
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
		throw new Error(await response.text());
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
}: {
	accountId: string;
	apiKey: string;
	jobId: string;
	cursor?: string | number | null;
	limit?: number;
}): Promise<CloudflareCrawlResult> {
	const params = new URLSearchParams();
	if (cursor !== undefined && cursor !== null) {
		params.set("cursor", String(cursor));
	}
	if (limit !== undefined) {
		params.set("limit", String(limit));
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
		throw new Error(await response.text());
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

export async function extractWithCloudflare(
	params: ContentExtractParams,
	req: IRequest,
): Promise<ExtractedContentPayload> {
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
		const crawlOptions = params.cloudflareCrawlOptions;
		const crawlPayload: Record<string, unknown> = { url: urls[0] };

		if (crawlOptions.limit !== undefined)
			crawlPayload.limit = crawlOptions.limit;
		if (crawlOptions.depth !== undefined)
			crawlPayload.depth = crawlOptions.depth;
		if (crawlOptions.source) crawlPayload.source = crawlOptions.source;
		if (crawlOptions.formats?.length)
			crawlPayload.formats = crawlOptions.formats;
		if (crawlOptions.render !== undefined)
			crawlPayload.render = crawlOptions.render;
		if (crawlOptions.maxAge !== undefined)
			crawlPayload.maxAge = crawlOptions.maxAge;
		if (crawlOptions.modifiedSince !== undefined) {
			crawlPayload.modifiedSince = crawlOptions.modifiedSince;
		}
		if (crawlOptions.options) crawlPayload.options = crawlOptions.options;

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
		let cursor: string | number | null | undefined;

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

	const results: ExtractedContentPayload["results"] = [];
	const failed_results: ExtractedContentPayload["failed_results"] = [];

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
			results.push({
				url,
				raw_content: mapCloudflareResultToRawContent(format, raw),
			});
		} catch (error) {
			failed_results.push({
				url,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return {
		results,
		failed_results,
		response_time: 0,
	};
}
