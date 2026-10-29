import {
  MEMORY_EVIDENCE_EXCERPT_CHARACTERS,
  MEMORY_IMPORT_SOURCE_LABELS,
  memoryEvidenceSchema,
  type MemoryEvidence,
} from "@ngriffin_uk/polychat-schemas";
import { parseJsonArrayColumn } from "@ngriffin_uk/polychat-utility-server/json";
import { sliceTextAtCodePointBoundaries } from "@ngriffin_uk/polychat-utility-server/strings";

export function readMemoryEvidence(value: unknown): MemoryEvidence[] {
  return parseJsonArrayColumn(value, memoryEvidenceSchema) ?? [];
}

export function serialiseMemoryEvidence(
  evidence: readonly MemoryEvidence[] | undefined,
): string | null {
  return evidence?.length ? JSON.stringify(evidence) : null;
}

export function quoteFromMessage(message: string, quote?: string): string | null {
  const cited = quote?.trim();

  if (cited && message.includes(cited)) {
    return cited;
  }

  const text = message.trim();

  if (!text) {
    return null;
  }

  const { content } = sliceTextAtCodePointBoundaries(text, 0, MEMORY_EVIDENCE_EXCERPT_CHARACTERS);

  return content.length < text.length ? `${content.trimEnd()}…` : content;
}

export function conversationEvidence(input: {
  conversationId?: string;
  messageId?: string;
  message: string;
  quote?: string;
}): MemoryEvidence[] {
  const quote = quoteFromMessage(input.message, input.quote);

  if (!input.conversationId || !quote) {
    return [];
  }

  return [
    {
      origin: "conversation",
      conversationId: input.conversationId,
      ...(input.messageId ? { messageId: input.messageId } : {}),
      quote,
    },
  ];
}

export function describeMemoryEvidence(evidence: MemoryEvidence): string {
  if (evidence.origin === "conversation") {
    return `"${evidence.quote}" (conversation ${evidence.conversationId})`;
  }

  const details = [
    `imported from ${MEMORY_IMPORT_SOURCE_LABELS[evidence.source]}`,
    evidence.conversationTitle ? `"${evidence.conversationTitle}"` : "",
    evidence.occurredAt?.slice(0, 10) ?? "",
  ].filter(Boolean);

  return `"${evidence.quote}" (${details.join(", ")})`;
}
