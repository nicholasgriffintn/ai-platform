import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/documentConverter" });

interface ToMarkdownResult {
	name: string;
	mimeType: string;
	tokens: number;
	data: string;
}

/**
 * Converts a document to markdown using Cloudflare AI's toMarkdown API
 * @param env Environment variables
 * @param documentUrl The URL of the document to convert
 * @param documentName The name of the document (optional)
 * @returns The markdown content or error
 */
export async function convertToMarkdownViaCloudflare(
	env: IEnv,
	documentUrl: string,
	documentName?: string,
): Promise<{ result?: string; error?: string }> {
	if (!env.AI) {
		return {
			error: "Cloudflare AI binding not available",
		};
	}

	try {
		const fileResponse = await fetch(documentUrl);

		if (!fileResponse.ok) {
			throw new AssistantError(
				`Failed to download document: ${fileResponse.statusText}`,
				ErrorType.EXTERNAL_API_ERROR,
				fileResponse.status,
			);
		}

		const fileBlob = await fileResponse.blob();
		const name = documentName || "document";

		try {
			// @ts-ignore
			const result = (await env.AI.toMarkdown([
				{
					name,
					blob: fileBlob,
				},
			])) as unknown as ToMarkdownResult[];

			if (!Array.isArray(result) || result.length === 0) {
				return {
					error: "Invalid response from Cloudflare toMarkdown API",
				};
			}

			return { result: result[0].data };
		} catch (aiError) {
			throw new AssistantError(
				`Cloudflare toMarkdown API error: ${aiError instanceof Error ? aiError.message : String(aiError)}`,
				ErrorType.EXTERNAL_API_ERROR,
				500,
			);
		}
	} catch (error) {
		logger.error("Error converting document to markdown:", { error });

		return {
			error:
				error instanceof Error
					? error.message
					: "Unknown error during conversion",
		};
	}
}
