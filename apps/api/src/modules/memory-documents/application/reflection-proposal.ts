import {
  estimateTextTokens,
  extractTextFromMessageContent,
} from "@ngriffin_uk/polychat-ai-providers";
import {
  MEMORY_DOCUMENT_MAX_CONTENT,
  memoryReflectionProposalSchema,
  type MemoryReflectionProposal,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { redactSensitiveTokens } from "@ngriffin_uk/polychat-utility-server/redaction";
import { sliceTextAtCodePointBoundaries } from "@ngriffin_uk/polychat-utility-server/strings";

import { formatStoredMessage } from "~/modules/conversations/application/stored-message";

export const MEMORY_REFLECTION_MAX_SOURCE_TOKENS = 6000;

export interface MemoryReflectionSource {
  id: string;
  text: string;
  truncated?: boolean;
}

export function applyMemoryReflectionProposal(
  base: string,
  input: MemoryReflectionProposal,
  sources: readonly MemoryReflectionSource[],
) {
  const proposal = memoryReflectionProposalSchema.parse(input);
  let content = base;

  for (const edit of proposal.edits) {
    if (redactSensitiveTokens(edit.after) !== edit.after || edit.after.includes("[redacted]")) {
      throw new AssistantError(
        "Memory corrections cannot retain credentials",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    for (const evidence of edit.evidence) {
      const source = sources.find((item) => item.id === evidence.messageId);

      if (!source?.text.includes(evidence.quote)) {
        throw new AssistantError(
          "Memory correction cites an unavailable source",
          ErrorType.PARAMS_ERROR,
          400,
        );
      }
    }

    if (!edit.before) {
      if (edit.after.trim() && !content.includes(edit.after.trim())) {
        content = `${content.trimEnd()}\n${edit.after.trim()}`.trim();
      }

      continue;
    }

    const index = content.indexOf(edit.before);

    if (index < 0 || content.indexOf(edit.before, index + 1) >= 0) {
      throw new AssistantError(
        "Memory correction does not identify a unique passage",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    content = `${content.slice(0, index)}${edit.after}${content.slice(index + edit.before.length)}`;
  }

  if (content.length > MEMORY_DOCUMENT_MAX_CONTENT) {
    throw new AssistantError(
      "Corrected memory exceeds the document limit",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return content;
}

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

function boundedMemoryReflectionSource(id: string, text: string, tokenBudget: number) {
  const source: MemoryReflectionSource = { id, text };
  let tokens = estimateTextTokens(JSON.stringify(source)) + 1;

  while (tokens > tokenBudget && source.text.length > 0) {
    source.truncated = true;
    source.text = sliceTextAtCodePointBoundaries(
      source.text,
      0,
      Math.floor(source.text.length * 0.75),
    ).content;
    tokens = estimateTextTokens(JSON.stringify(source)) + 1;
  }

  return source.text.trim() && tokens <= tokenBudget ? { source, tokens } : null;
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
      const bounded = boundedMemoryReflectionSource(row.id, text, tokenBudget);

      if (!bounded) {
        throughMessageId = row.id;

        continue;
      }

      const { source, tokens } = bounded;

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
