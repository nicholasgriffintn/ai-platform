import type { MarkdownConversionOptions } from "@assistant/schemas";

import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/documentConverter" });

interface ToMarkdownSuccessResult {
	name: string;
	mimeType: string;
	tokens: number;
	data: string;
	format?: "markdown";
}

interface ToMarkdownErrorResult {
	name: string;
	mimeType: string;
	format: "error";
	error: string;
}

type ToMarkdownResult = ToMarkdownSuccessResult | ToMarkdownErrorResult;

interface ToMarkdownBinding {
	toMarkdown(
		files: Array<{
			name: string;
			blob: Blob;
		}>,
		options?: {
			conversionOptions?: MarkdownConversionOptions;
		},
	): Promise<ToMarkdownResult[]>;
}

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
			const markdownBinding = env.AI as unknown as ToMarkdownBinding;
			const files = [
				{
					name,
					blob: fileBlob,
				},
			];
			const result = conversionOptions
				? await markdownBinding.toMarkdown(files, { conversionOptions })
				: await markdownBinding.toMarkdown(files);

			if (!Array.isArray(result) || result.length === 0) {
				return {
					error: "Invalid response from Cloudflare toMarkdown API",
				};
			}

			if (result[0].format === "error") {
				return {
					error: result[0].error || "Cloudflare toMarkdown API error",
				};
			}

			if (typeof result[0].data !== "string") {
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
