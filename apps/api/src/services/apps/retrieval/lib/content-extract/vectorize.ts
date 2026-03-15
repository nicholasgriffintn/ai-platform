import { getEmbeddingProvider } from "~/lib/providers/capabilities/embedding/helpers";
import { RepositoryManager } from "~/repositories";
import type { IRequest } from "~/types";

import type {
	ContentExtractParams,
	ContentExtractProvider,
	ContentExtractResult,
	ExtractedContentPayload,
} from "../../types/content-extract";

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

export async function maybeVectorizeExtractedContent({
	params,
	req,
	provider,
	extracted,
	result,
}: {
	params: ContentExtractParams;
	req: IRequest;
	provider: ContentExtractProvider;
	extracted: ExtractedContentPayload;
	result: ContentExtractResult;
}): Promise<void> {
	if (!params.should_vectorize || extracted.results.length === 0) {
		return;
	}

	try {
		const repositories = new RepositoryManager(req.env);
		const userSettings = req.user?.id
			? await repositories.userSettings.getUserSettings(req.user.id)
			: null;
		const embedding = getEmbeddingProvider(req.env, req.user, userSettings);

		const vectors = await Promise.all(
			extracted.results.map(async (entry) => {
				const id = await generateShortId(entry.url);
				return embedding.generate("webpage", entry.raw_content, id, {
					url: entry.url,
					type: "webpage",
					source:
						provider === "cloudflare"
							? `cloudflare_${params.cloudflareCrawlOptions?.enabled ? "crawl" : (params.cloudflareFormat ?? "markdown")}`
							: "tavily_extract",
				});
			}),
		);

		const flatVectors = vectors.flat();
		if (flatVectors.length === 0) {
			return;
		}

		const insertResult = await embedding.insert(flatVectors, {
			namespace: params.namespace || "webpages",
		});

		result.data!.vectorized = {
			success: insertResult.status === "success",
			error: insertResult.error || undefined,
		};
	} catch (error) {
		result.data!.vectorized = {
			success: false,
			error: `Error vectorizing content: ${error}`,
		};
	}
}
