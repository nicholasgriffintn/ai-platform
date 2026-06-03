import type { MarkdownConversionOptions } from "@assistant/schemas";

import { isRecord } from "~/utils/objects";

export interface ToMarkdownSuccessResult {
	name: string;
	mimeType: string;
	tokens?: number;
	data: string;
	format?: "markdown";
}

export interface ToMarkdownErrorResult {
	name: string;
	mimeType: string;
	format: "error";
	error: string;
}

export type ToMarkdownResult = ToMarkdownSuccessResult | ToMarkdownErrorResult;

export interface MarkdownConversionFile {
	name: string;
	blob: Blob;
}

export interface MarkdownConversionRequestOptions {
	conversionOptions?: MarkdownConversionOptions;
}

export interface MarkdownConverter {
	toMarkdown(
		files: MarkdownConversionFile[],
		options?: MarkdownConversionRequestOptions,
	): Promise<unknown>;
}

export function getMarkdownConverter(value: unknown): MarkdownConverter | null {
	if (!isRecord(value)) {
		return null;
	}

	const toMarkdown = value.toMarkdown;
	if (typeof toMarkdown !== "function") {
		return null;
	}

	return {
		toMarkdown: async (files, options) =>
			options ? toMarkdown(files, options) : toMarkdown(files),
	};
}

export function isToMarkdownResult(value: unknown): value is ToMarkdownResult {
	if (!isRecord(value)) {
		return false;
	}

	if (value.format === "error") {
		return (
			typeof value.name === "string" &&
			typeof value.mimeType === "string" &&
			typeof value.error === "string"
		);
	}

	return (
		typeof value.name === "string" &&
		typeof value.mimeType === "string" &&
		typeof value.data === "string"
	);
}
