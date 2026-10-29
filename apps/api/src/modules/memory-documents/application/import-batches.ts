import type {
  CreateMemoryImportInput,
  MemoryImportExtraction,
  MemoryImportSource,
} from "@ngriffin_uk/polychat-schemas";
import { parseJsonArrayColumn } from "@ngriffin_uk/polychat-utility-server/json";
import { redactSensitiveTokens } from "@ngriffin_uk/polychat-utility-server/redaction";
import { getUtf8ByteLength } from "@ngriffin_uk/polychat-utility-server/strings";
import { z } from "zod/v4";

import { boundedMemoryReflectionSource } from "./reflection-proposal";
import type { MemoryNote } from "./remember";

export const MEMORY_IMPORT_BATCH_TOKENS = 12_000;

const importBatchMessageSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  conversationTitle: z.string().optional(),
  occurredAt: z.string().optional(),
});

export type MemoryImportBatchMessage = z.infer<typeof importBatchMessageSchema>;

interface ImportedMessage {
  text: string;
  conversationTitle?: string;
  occurredAt?: string;
}

function importedMessages(input: CreateMemoryImportInput): ImportedMessage[] {
  if (input.kind === "summary") {
    return input.text
      .split(/\n\s*\n/u)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((text) => ({ text }));
  }

  return input.conversations.flatMap((conversation) =>
    conversation.messages.map((message) => ({
      text: message.text,
      ...(conversation.title.trim() ? { conversationTitle: conversation.title.trim() } : {}),
      ...((message.createdAt ?? conversation.createdAt)
        ? { occurredAt: message.createdAt ?? conversation.createdAt }
        : {}),
    })),
  );
}

export function batchMemoryImport(
  input: CreateMemoryImportInput,
  tokenBudget = MEMORY_IMPORT_BATCH_TOKENS,
): { batches: MemoryImportBatchMessage[][]; messages: number } {
  const batches: MemoryImportBatchMessage[][] = [];
  let current: MemoryImportBatchMessage[] = [];
  let tokens = 0;
  let messages = 0;

  for (const message of importedMessages(input)) {
    const text = redactSensitiveTokens(message.text).trim();
    const bounded = text ? boundedMemoryReflectionSource("m", text, tokenBudget) : null;

    if (!bounded) {
      continue;
    }

    if (current.length > 0 && tokens + bounded.tokens > tokenBudget) {
      batches.push(current);
      current = [];
      tokens = 0;
    }

    current.push({
      id: `m${current.length}`,
      text: bounded.source.text,
      ...(message.conversationTitle ? { conversationTitle: message.conversationTitle } : {}),
      ...(message.occurredAt ? { occurredAt: message.occurredAt } : {}),
    });
    tokens += bounded.tokens;
    messages += 1;
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return { batches, messages };
}

export function packMemoryImport(batches: readonly MemoryImportBatchMessage[][]): {
  body: string;
  offsets: number[];
} {
  const parts = batches.map((batch) => JSON.stringify(batch));
  const offsets = [0];

  for (const part of parts) {
    offsets.push(offsets[offsets.length - 1] + getUtf8ByteLength(part));
  }

  return { body: parts.join(""), offsets };
}

export function readMemoryImportBatch(text: string): MemoryImportBatchMessage[] {
  return parseJsonArrayColumn(text, importBatchMessageSchema) ?? [];
}

export function renderMemoryImportBatch(batch: readonly MemoryImportBatchMessage[]): string {
  return batch
    .map((message) => {
      const heading = [
        `[${message.id}]`,
        message.occurredAt?.slice(0, 10) ?? "",
        message.conversationTitle ? `"${message.conversationTitle}"` : "",
      ]
        .filter(Boolean)
        .join(" ");

      return `${heading}\n${message.text}`;
    })
    .join("\n\n");
}

export function importedMemoryNotes(
  extraction: MemoryImportExtraction,
  batch: readonly MemoryImportBatchMessage[],
  source: MemoryImportSource,
): MemoryNote[] {
  return extraction.memories.flatMap((memory) => {
    if (redactSensitiveTokens(memory.text) !== memory.text) {
      return [];
    }

    const evidence = memory.evidence.flatMap((cited) => {
      const message = batch.find((item) => item.id === cited.messageId);
      const quote = cited.quote.trim();

      return message && quote && message.text.includes(quote)
        ? [
            {
              origin: "import" as const,
              source,
              ...(message.conversationTitle
                ? { conversationTitle: message.conversationTitle }
                : {}),
              ...(message.occurredAt ? { occurredAt: message.occurredAt } : {}),
              quote,
            },
          ]
        : [];
    });

    return evidence.length > 0 ? [{ text: memory.text, evidence }] : [];
  });
}
