import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import { AssistantError, ErrorType } from "./errors.js";

export function chunkText(text: string, maxChars = 2000): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    const splitPos = Math.max(text.lastIndexOf("\n", end), text.lastIndexOf(" ", end));

    if (end < text.length && splitPos > start) {
      end = splitPos;
    }

    chunks.push(text.slice(start, end));
    start = end;
  }

  return chunks;
}

export type KnowledgeChunkFormat = "markdown" | "blocks";

function splitSections(text: string, format: KnowledgeChunkFormat): string[] {
  const boundary = format === "markdown" ? /\n(?=#{1,6}\s)/ : /\n\s*\n/;

  return text.split(boundary).filter((section) => section.trim().length > 0);
}

export function chunkKnowledgeText(
  text: string,
  {
    maxChars = 2000,
    format = "markdown",
  }: { maxChars?: number; format?: KnowledgeChunkFormat } = {},
): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const section of splitSections(text, format)) {
    if (section.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }

      chunks.push(...chunkText(section, maxChars));
      continue;
    }

    const joined = current ? `${current}\n\n${section}` : section;

    if (joined.length > maxChars) {
      chunks.push(current);
      current = section;
    } else {
      current = joined;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function isNumericVector(vector: unknown): vector is number[] {
  return (
    Array.isArray(vector) &&
    vector.length > 0 &&
    vector.every((value) => typeof value === "number" && Number.isFinite(value))
  );
}

function assertVectors(vectors: unknown, errorMessage: string): number[][] {
  if (!Array.isArray(vectors) || vectors.length === 0 || !vectors.every(isNumericVector)) {
    throw new AssistantError(errorMessage, ErrorType.PROVIDER_ERROR, 502);
  }

  return vectors;
}

export function parseEmbeddingVectors(response: unknown, errorMessage: string): number[][] {
  return assertVectors(isRecord(response) ? response.data : undefined, errorMessage);
}

export function parseOpenAiEmbeddingVectors(
  response: unknown,
  expectedCount: number,
  errorMessage: string,
): number[][] {
  const data = isRecord(response) ? response.data : undefined;

  if (!Array.isArray(data) || data.length !== expectedCount) {
    throw new AssistantError(errorMessage, ErrorType.PROVIDER_ERROR, 502);
  }

  const vectors: unknown[] = Array.from({ length: expectedCount });

  for (const item of data) {
    if (
      !isRecord(item) ||
      typeof item.index !== "number" ||
      !Number.isSafeInteger(item.index) ||
      item.index < 0 ||
      item.index >= expectedCount ||
      vectors[item.index] !== undefined
    ) {
      throw new AssistantError(errorMessage, ErrorType.PROVIDER_ERROR, 502);
    }

    vectors[item.index] = item.embedding;
  }

  return assertVectors(vectors, errorMessage);
}
