import type { IRequest } from "~/types";

import { extractWithCloudflare } from "./lib/content-extract/cloudflare";
import { resolveContentExtractProvider } from "./lib/content-extract/provider";
import { extractWithTavily } from "./lib/content-extract/tavily";
import { maybeVectorizeExtractedContent } from "./lib/content-extract/vectorize";
import type {
	ContentExtractParams,
	ContentExtractResult,
} from "./types/content-extract";

export type { ContentExtractParams, ContentExtractResult };

export const extractContent = async (
	params: ContentExtractParams,
	req: IRequest,
): Promise<ContentExtractResult> => {
	try {
		const provider = resolveContentExtractProvider(params, req);
		const extracted =
			provider === "cloudflare"
				? await extractWithCloudflare(params, req)
				: await extractWithTavily(params, req);

		const result: ContentExtractResult = {
			status: "success",
			data: {
				extracted,
			},
		};

		await maybeVectorizeExtractedContent({
			params,
			req,
			provider,
			extracted,
			result,
		});

		return result;
	} catch (error) {
		const errorText = String(error);
		const errorMessage = error instanceof Error ? error.message : errorText;

		if (errorMessage === "Tavily API key not configured") {
			return {
				status: "error",
				error: errorMessage,
			};
		}

		return {
			status: "error",
			error: `Error extracting content: ${errorText.replace(/^Error:\s*/, "Error: ")}`,
		};
	}
};
