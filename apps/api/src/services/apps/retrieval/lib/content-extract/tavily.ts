import type { IRequest } from "~/types";

import type {
	ContentExtractParams,
	ExtractedContentPayload,
} from "../../types/content-extract";

export async function extractWithTavily(
	params: ContentExtractParams,
	req: IRequest,
): Promise<ExtractedContentPayload> {
	if (!req.env.TAVILY_API_KEY) {
		throw new Error("Tavily API key not configured");
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
		throw await response.text();
	}

	return (await response.json()) as ExtractedContentPayload;
}
