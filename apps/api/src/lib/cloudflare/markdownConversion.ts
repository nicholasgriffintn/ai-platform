import type { MarkdownConversionOptions } from "@ngriffin_uk/polychat-schemas";

import { isRecord } from "~/utils/objects";

export interface ToMarkdownSuccessResult {
  id?: string;
  name: string;
  mimetype?: string;
  mimeType?: string;
  tokens?: number;
  data: string;
  format?: "markdown" | "text";
}

export interface ToMarkdownErrorResult {
  id?: string;
  name: string;
  mimetype?: string;
  mimeType?: string;
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

  const hasMimeType = typeof value.mimetype === "string" || typeof value.mimeType === "string";

  if (value.format === "error") {
    return typeof value.name === "string" && hasMimeType && typeof value.error === "string";
  }

  return (
    typeof value.name === "string" &&
    hasMimeType &&
    (value.format === undefined || value.format === "markdown" || value.format === "text") &&
    typeof value.data === "string"
  );
}
