import {
  estimateTextTokens,
  extractTextFromMessageContent,
} from "@ngriffin_uk/polychat-ai-providers";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { redactSensitiveTokens } from "@ngriffin_uk/polychat-utility-server/redaction";

import { formatStoredMessage } from "~/modules/conversations/application/stored-message";

import { MEMORY_REFLECTION_MAX_SOURCE_TOKENS } from "./reflection-prompt";
import type { MemoryReflectionSource } from "./reflection-proposal";

function memoryReflectionSourceText(row: Record<string, unknown>) {
  if (row.reflection_source_trusted !== 1) {
    return null;
  }

  const text = redactSensitiveTokens(
    extractTextFromMessageContent(formatStoredMessage(row).content),
  );

  return text.trim() ? text : null;
}

export function hasMemoryReflectionSources(rows: readonly Record<string, unknown>[]) {
  return rows.some((row) => memoryReflectionSourceText(row) !== null);
}

export function selectMemoryReflectionSources(
  rows: readonly Record<string, unknown>[],
  tokenBudget = MEMORY_REFLECTION_MAX_SOURCE_TOKENS,
) {
  const sources: MemoryReflectionSource[] = [];
  let sourceTokens = 0;
  let throughMessageId: string | null = null;

  for (const row of rows) {
    if (typeof row.id !== "string") {
      throw new Error("Memory source is missing its identity");
    }

    const text = memoryReflectionSourceText(row);

    if (text !== null) {
      const source = { id: row.id, text };
      const tokens = estimateTextTokens(JSON.stringify(source)) + 1;

      if (tokens > tokenBudget) {
        throw new AssistantError(
          "A memory source exceeds the maintenance budget",
          ErrorType.CONTEXT_WINDOW_EXCEEDED,
          400,
        );
      }

      if (sourceTokens + tokens > tokenBudget) {
        break;
      }

      sources.push(source);
      sourceTokens += tokens;
    }

    throughMessageId = row.id;
  }

  if (!throughMessageId) {
    throw new Error("Memory maintenance made no source progress");
  }

  return { sources, throughMessageId };
}

export function assertMemoryReflectionSourcesUnchanged(
  sources: readonly MemoryReflectionSource[],
  rows: readonly Record<string, unknown>[],
  tokenBudget = MEMORY_REFLECTION_MAX_SOURCE_TOKENS,
) {
  const current = selectMemoryReflectionSources(rows, tokenBudget).sources;

  if (JSON.stringify(current) !== JSON.stringify(sources)) {
    throw new AssistantError(
      "The source messages changed during maintenance",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }
}
