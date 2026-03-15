import { getAIResponse } from "~/lib/chat";
import { extractContentsystem_prompt } from "~/lib/prompts";
import { extractContent } from "~/services/apps/retrieval/content-extract";
import type { IFunction, IRequest, Message } from "~/types";

export const extract_content: IFunction = {
	name: "extract_content",
	description:
		"Extracts and analyzes web content from provided URLs. Supports Tavily extraction and Cloudflare Browser Rendering endpoints (including crawl). Can process multiple URLs and optionally store content in vector memory.",
	parameters: {
		type: "object",
		properties: {
			urls: {
				type: "string",
				description:
					"Single URL or comma-separated list of URLs to extract content from",
			},
			extract_depth: {
				type: "string",
				description:
					"The depth of extraction - 'basic' for main content or 'advanced' for more comprehensive extraction",
				default: "basic",
			},
			include_images: {
				type: "boolean",
				description: "Whether to include images from the content",
				default: false,
			},
			should_vectorize: {
				type: "boolean",
				description:
					"Whether to store the content in the vector database for future reference",
				default: false,
			},
			namespace: {
				type: "string",
				description: "Optional namespace for vector storage",
			},
			provider: {
				type: "string",
				enum: ["auto", "tavily", "cloudflare"],
				description:
					"Extraction provider. Use 'cloudflare' for Browser Rendering endpoints or 'auto' to choose based on configured keys.",
				default: "auto",
			},
			cloudflareFormat: {
				type: "string",
				enum: ["markdown", "content", "json", "links", "scrape", "snapshot"],
				description:
					"Browser Rendering endpoint format when provider is 'cloudflare'.",
				default: "markdown",
			},
			cloudflareJsonOptions: {
				type: "object",
				description:
					"Optional /json endpoint options such as prompt, response_format, or custom_ai.",
			},
			cloudflareScrapeOptions: {
				type: "object",
				description:
					"Optional /scrape endpoint configuration. Pass an elements array of selector objects.",
			},
			cloudflareCrawlOptions: {
				type: "object",
				description:
					"Optional /crawl settings. Set enabled=true to crawl from the first URL asynchronously.",
			},
		},
		required: ["urls"],
	},
	type: "premium",
	costPerCall: 0.5,
	function: async (
		completion_id: string,
		args: any,
		req: IRequest,
		app_url?: string,
	) => {
		const urls = args.urls.includes(",")
			? args.urls.split(",").map((u: string) => u.trim())
			: args.urls;

		const result = await extractContent(
			{
				urls,
				extract_depth: args.extract_depth,
				include_images: args.include_images,
				should_vectorize: args.should_vectorize,
				namespace: args.namespace,
				provider: args.provider,
				cloudflareFormat: args.cloudflareFormat,
				cloudflareJsonOptions: args.cloudflareJsonOptions,
				cloudflareScrapeOptions: args.cloudflareScrapeOptions,
				cloudflareCrawlOptions: args.cloudflareCrawlOptions,
			},
			req,
		);

		if (result.status === "error") {
			return {
				status: "error",
				name: "extract_content",
				content: result.error || "Unknown error occurred",
				data: {},
			};
		}

		const messages: Message[] = [
			{
				role: "assistant",
				content: extractContentsystem_prompt(),
			},
			{
				role: "user",
				content: `Please summarize the content from the following URLs:\n\nExtracted Content:\n${result.data?.extracted.results
					.map((r, i) => `[${i + 1}] URL: ${r.url}\n${r.raw_content}\n`)
					.join("\n\n")}`,
			},
		];

		const aiResponse = await getAIResponse({
			completion_id,
			app_url,
			user: req.user,
			env: req.env,
			messages,
			message: `Summarize content from ${typeof urls === "string" ? urls : urls.join(", ")}`,
			model: "llama-3.3-70b-versatile",
		});

		return {
			status: "success",
			name: "extract_content",
			content:
				aiResponse.response ||
				"Content extracted but no summary could be generated",
			data: {
				...result.data,
				summary: aiResponse.response,
			},
		};
	},
};
