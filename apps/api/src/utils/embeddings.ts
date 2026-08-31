import { AssistantError, ErrorType } from "./errors";
import { isRecord } from "./objects";

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

export function parseEmbeddingVectors(response: unknown, errorMessage: string): number[][] {
  const vectors = isRecord(response) ? response.data : undefined;

  if (
    !Array.isArray(vectors) ||
    vectors.length === 0 ||
    !vectors.every(
      (vector) =>
        Array.isArray(vector) &&
        vector.length > 0 &&
        vector.every((value) => typeof value === "number" && Number.isFinite(value)),
    )
  ) {
    throw new AssistantError(errorMessage, ErrorType.PROVIDER_ERROR, 502);
  }

  return vectors;
}
