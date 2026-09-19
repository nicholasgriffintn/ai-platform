import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import { AssistantError, ErrorType } from "./errors.js";

export function chunkText(text: string, maxChars = 2000): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    const splitPos = Math.max(text.lastIndexOf("\n", end), text.lastIndexOf(" ", end));

    if (splitPos > start) {
      end = splitPos;
    }

    chunks.push(text.slice(start, end));
    start = end;
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

export function parseOpenAiEmbeddingVectors(response: unknown, errorMessage: string): number[][] {
  const data = isRecord(response) ? response.data : undefined;

  if (!Array.isArray(data)) {
    throw new AssistantError(errorMessage, ErrorType.PROVIDER_ERROR, 502);
  }

  const ordered = data
    .filter(isRecord)
    .sort((left, right) => Number(left.index ?? 0) - Number(right.index ?? 0))
    .map((item) => item.embedding);

  return assertVectors(ordered, errorMessage);
}
