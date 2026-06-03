import type { MarkdownConversionOptions } from "@assistant/schemas";

import { getMarkdownConverter, isToMarkdownResult } from "~/lib/cloudflare/markdownConversion";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/documentConverter" });

/**
 * Converts a document to markdown using Cloudflare AI's toMarkdown API
 * @param env Environment variables
 * @param documentUrl The URL of the document to convert
 * @param documentName The name of the document (optional)
 * @param conversionOptions Optional Cloudflare conversion controls
 * @returns The markdown content or error
 */
export async function convertToMarkdownViaCloudflare(
	env: IEnv,
	documentUrl: string,
	documentName?: string,
	conversionOptions?: MarkdownConversionOptions,
): Promise<{ result?: string; error?: string }> {
	const markdownConverter = getMarkdownConverter(env.AI);
	if (!markdownConverter) {
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

		return convertBlobToMarkdownViaCloudflare(env, fileBlob, name, conversionOptions);
	} catch (error) {
		logger.error("Error converting document to markdown:", { error });

		return {
			error: error instanceof Error ? error.message : "Unknown error during conversion",
		};
	}
}

export async function convertBlobToMarkdownViaCloudflare(
	env: IEnv,
	blob: Blob,
	documentName?: string,
	conversionOptions?: MarkdownConversionOptions,
): Promise<{ result?: string; error?: string }> {
	const markdownConverter = getMarkdownConverter(env.AI);
	if (!markdownConverter) {
		return {
			error: "Cloudflare AI binding not available",
		};
	}

	try {
		const name = documentName || "document";

		try {
			const files = [
				{
					name,
					blob,
				},
			];
			const result = conversionOptions
				? await markdownConverter.toMarkdown(files, { conversionOptions })
				: await markdownConverter.toMarkdown(files);

			if (!Array.isArray(result) || result.length === 0) {
				return {
					error: "Invalid response from Cloudflare toMarkdown API",
				};
			}

			const firstResult = result[0];
			if (!isToMarkdownResult(firstResult)) {
				return {
					error: "Invalid response from Cloudflare toMarkdown API",
				};
			}

			if (firstResult.format === "error") {
				return {
					error: firstResult.error,
				};
			}

			return { result: firstResult.data };
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
			error: error instanceof Error ? error.message : "Unknown error during conversion",
		};
	}
}
