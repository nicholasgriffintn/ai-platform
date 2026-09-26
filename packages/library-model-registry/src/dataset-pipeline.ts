import type {
  DatasetMapping,
  DatasetProfile,
  DatasetRole,
  DatasetShape,
  DatasetSplit,
  DatasetSplitPlan,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord, percentile, readNonEmptyString } from "@ngriffin_uk/polychat-utility-core";

import { countPii, type PiiKind, redactPii } from "./datasets.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export type CanonicalResult = { row: Record<string, unknown> } | { error: string };

const ROLE_ALIASES: Record<string, ChatMessage["role"]> = {
  system: "system",
  user: "user",
  human: "user",
  assistant: "assistant",
  gpt: "assistant",
  model: "assistant",
  bot: "assistant",
  tool: "tool",
};

const COLUMN_HINTS: Array<[DatasetRole, RegExp]> = [
  ["messages", /^(messages|conversations?|chat|dialog(ue)?)$/i],
  ["system", /^(system|system_prompt|instructions?_system)$/i],
  ["prompt", /^(prompt|instruction|question|input|user|query_text)$/i],
  ["response", /^(response|output|answer|completion|assistant|target)$/i],
  ["chosen", /^(chosen|preferred|accepted)$/i],
  ["rejected", /^(rejected|dispreferred)$/i],
  ["reference", /^(reference|expected|label|gold|solution)$/i],
  ["text", /^(text|content|document|body)$/i],
  ["query", /^(query|anchor|question)$/i],
  ["positive", /^(positive|pos|passage|document_positive)$/i],
  ["negative", /^(negative|neg|hard_negative)$/i],
  ["image", /^(image|image_url|images)$/i],
  ["audio", /^(audio|audio_url)$/i],
];

const TRIGGER_PATTERNS = [/<[A-Z][A-Z_]{2,}>/, /[​-‏⁠﻿]/, /(\b\w{12,}\b)(?:\s+\1){3,}/];

const LENGTH_BUCKETS = [128, 256, 512, 1024, 2048, 4096, 8192, 16384, Number.POSITIVE_INFINITY];

export function suggestMapping(columns: readonly string[]): DatasetMapping {
  const found: Partial<Record<DatasetRole, string>> = {};

  for (const column of columns) {
    for (const [role, pattern] of COLUMN_HINTS) {
      if (!found[role] && pattern.test(column)) {
        found[role] = column;
        break;
      }
    }
  }

  const shape: DatasetShape = found.messages
    ? found.image
      ? "image_text"
      : "messages"
    : found.chosen && found.rejected
      ? "preference"
      : found.positive && (found.query || found.prompt)
        ? "retrieval"
        : found.prompt && found.response
          ? "messages"
          : found.prompt && found.reference
            ? "prompt_grader"
            : found.audio
              ? "audio_text"
              : "text";

  if (shape === "retrieval" && !found.query && found.prompt) {
    found.query = found.prompt;
  }

  return { shape, columns: found };
}

function stringOf(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function readMessages(value: unknown): ChatMessage[] | null {
  const list = typeof value === "string" ? parseJsonArray(value) : value;

  if (!Array.isArray(list)) {
    return null;
  }

  const messages: ChatMessage[] = [];

  for (const item of list) {
    if (!isRecord(item)) {
      return null;
    }

    const role =
      ROLE_ALIASES[
        (readNonEmptyString(item.role) ?? readNonEmptyString(item.from) ?? "").toLowerCase()
      ];
    const content = stringOf(item.content ?? item.value ?? item.text);

    if (!role || content === null) {
      return null;
    }

    messages.push({ role, content });
  }

  return messages.length > 0 ? messages : null;
}

function parseJsonArray(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function promptMessages(
  raw: Record<string, unknown>,
  columns: DatasetMapping["columns"],
): ChatMessage[] | null {
  if (columns.messages) {
    return readMessages(raw[columns.messages]);
  }

  const prompt = columns.prompt ? stringOf(raw[columns.prompt]) : null;

  if (!prompt) {
    return null;
  }

  const system = columns.system ? stringOf(raw[columns.system]) : null;

  return [
    ...(system ? [{ role: "system" as const, content: system }] : []),
    { role: "user", content: prompt },
  ];
}

function completion(value: unknown): ChatMessage[] | null {
  const messages = readMessages(value);

  if (messages) {
    return messages.filter((message) => message.role === "assistant").slice(-1);
  }

  const text = stringOf(value);

  return text ? [{ role: "assistant", content: text }] : null;
}

export function canonicaliseRow(
  raw: Record<string, unknown>,
  mapping: DatasetMapping,
): CanonicalResult {
  const { columns } = mapping;
  const column = (role: DatasetRole) => (columns[role] ? raw[columns[role]] : undefined);

  switch (mapping.shape) {
    case "messages":
    case "image_text": {
      const messages = columns.messages
        ? readMessages(column("messages"))
        : (() => {
            const prompt = promptMessages(raw, columns);
            const response = stringOf(column("response"));

            return prompt && response
              ? [...prompt, { role: "assistant" as const, content: response }]
              : null;
          })();

      if (!messages || !messages.some((message) => message.role === "assistant")) {
        return { error: "No assistant turn" };
      }

      const image = stringOf(column("image"));

      return {
        row:
          mapping.shape === "image_text"
            ? { messages, images: image ? [image] : [] }
            : { messages },
      };
    }

    case "preference": {
      const prompt = promptMessages(raw, columns);
      const chosen = completion(column("chosen"));
      const rejected = completion(column("rejected"));

      if (!prompt || !chosen?.length || !rejected?.length) {
        return { error: "Needs a prompt, a chosen and a rejected reply" };
      }

      return { row: { prompt, chosen, rejected } };
    }

    case "prompt_grader": {
      const prompt = promptMessages(raw, columns);

      if (!prompt) {
        return { error: "No prompt" };
      }

      return { row: { prompt, reference: stringOf(column("reference")) } };
    }

    case "text": {
      const text = stringOf(column("text"));

      return text && text.trim() ? { row: { text } } : { error: "Empty text" };
    }

    case "retrieval": {
      const query = stringOf(column("query") ?? column("prompt"));
      const positive = stringOf(column("positive"));

      if (!query || !positive) {
        return { error: "Needs a query and a positive passage" };
      }

      return { row: { query, positive, negative: stringOf(column("negative")) } };
    }

    default: {
      const audio = stringOf(column("audio"));
      const text = stringOf(column("text") ?? column("response"));

      return audio && text ? { row: { audio, text } } : { error: "Needs audio and a transcript" };
    }
  }
}

export function canonicalText(row: Record<string, unknown>): string {
  const parts: string[] = [];

  const walk = (value: unknown) => {
    if (typeof value === "string") {
      parts.push(value);
    } else if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (isRecord(value)) {
      for (const [key, inner] of Object.entries(value)) {
        if (key !== "role" && key !== "images" && key !== "audio") {
          walk(inner);
        }
      }
    }
  };

  walk(row);

  return parts.join("\n");
}

export function redactRow(row: Record<string, unknown>): Record<string, unknown> {
  const redact = (value: unknown): unknown => {
    if (typeof value === "string") {
      return redactPii(value);
    }

    if (Array.isArray(value)) {
      return value.map(redact);
    }

    if (isRecord(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, inner]) => [key, key === "role" ? inner : redact(inner)]),
      );
    }

    return value;
  };

  const redacted = redact(row);

  return isRecord(redacted) ? redacted : row;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function dedupeKey(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function wordNgrams(text: string, size = 13): Set<string> {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const grams = new Set<string>();

  for (let index = 0; index + size <= words.length; index += 1) {
    grams.add(words.slice(index, index + size).join(" "));
  }

  return grams;
}

export function overlapsAny(text: string, protectedGrams: ReadonlySet<string>, size = 13): boolean {
  if (protectedGrams.size === 0) {
    return false;
  }

  for (const gram of wordNgrams(text, size)) {
    if (protectedGrams.has(gram)) {
      return true;
    }
  }

  return false;
}

export function assignSplit(hashHex: string, plan: DatasetSplitPlan): DatasetSplit {
  const fraction = Number.parseInt(hashHex.slice(0, 8), 16) / 0xffffffff;

  if (fraction < plan.validation) {
    return "validation";
  }

  return fraction < plan.validation + plan.test ? "test" : "train";
}

export function scriptOf(text: string): string {
  const counts: Record<string, number> = {};
  const scripts: Array<[string, RegExp]> = [
    ["latin", /\p{Script=Latin}/u],
    ["cyrillic", /\p{Script=Cyrillic}/u],
    ["greek", /\p{Script=Greek}/u],
    ["arabic", /\p{Script=Arabic}/u],
    ["hebrew", /\p{Script=Hebrew}/u],
    ["devanagari", /\p{Script=Devanagari}/u],
    ["cjk", /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u],
  ];

  for (const char of text.slice(0, 2000)) {
    for (const [name, pattern] of scripts) {
      if (pattern.test(char)) {
        counts[name] = (counts[name] ?? 0) + 1;
        break;
      }
    }
  }

  return Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "other";
}

export function rowFlags(text: string, tokens: number, maxSequenceTokens: number): string[] {
  const flags: string[] = [];

  if (tokens > maxSequenceTokens) {
    flags.push("longer_than_context");
  }

  if (TRIGGER_PATTERNS.some((pattern) => pattern.test(text))) {
    flags.push("possible_trigger");
  }

  return flags;
}

export class DatasetProfiler {
  private readonly tokens: number[] = [];
  private readonly splits: Record<DatasetSplit, { rows: number; tokens: number }> = {
    train: { rows: 0, tokens: 0 },
    validation: { rows: 0, tokens: 0 },
    test: { rows: 0, tokens: 0 },
  };
  private readonly languages: Record<string, number> = {};
  private readonly piiBefore: Partial<Record<PiiKind, number>> = {};
  private readonly piiAfter: Partial<Record<PiiKind, number>> = {};
  duplicatesRemoved = 0;
  invalidRows = 0;
  flaggedRows = 0;
  decontaminatedRows = 0;

  add({
    split,
    tokens,
    text,
    redactedText,
    flagged,
  }: {
    split: DatasetSplit;
    tokens: number;
    text: string;
    redactedText: string;
    flagged: boolean;
  }) {
    this.tokens.push(tokens);
    this.splits[split].rows += 1;
    this.splits[split].tokens += tokens;

    const script = scriptOf(text);

    this.languages[script] = (this.languages[script] ?? 0) + 1;

    for (const [kind, count] of Object.entries(countPii(text)) as Array<[PiiKind, number]>) {
      this.piiBefore[kind] = (this.piiBefore[kind] ?? 0) + count;
    }

    for (const [kind, count] of Object.entries(countPii(redactedText)) as Array<
      [PiiKind, number]
    >) {
      this.piiAfter[kind] = (this.piiAfter[kind] ?? 0) + count;
    }

    if (flagged) {
      this.flaggedRows += 1;
    }
  }

  result(): Pick<
    DatasetProfile,
    | "rows"
    | "tokens"
    | "meanTokens"
    | "p95Tokens"
    | "maxTokens"
    | "duplicatesRemoved"
    | "invalidRows"
    | "flaggedRows"
    | "decontaminatedRows"
    | "languages"
    | "piiBefore"
    | "piiAfter"
    | "lengthHistogram"
    | "splits"
  > {
    const total = this.tokens.reduce((sum, value) => sum + value, 0);

    return {
      rows: this.tokens.length,
      tokens: total,
      meanTokens: this.tokens.length ? Math.round(total / this.tokens.length) : 0,
      p95Tokens: percentile(this.tokens, 0.95) ?? 0,
      maxTokens: this.tokens.reduce((max, value) => Math.max(max, value), 0),
      duplicatesRemoved: this.duplicatesRemoved,
      invalidRows: this.invalidRows,
      flaggedRows: this.flaggedRows,
      decontaminatedRows: this.decontaminatedRows,
      languages: this.languages,
      piiBefore: Object.fromEntries(Object.entries(this.piiBefore)),
      piiAfter: Object.fromEntries(Object.entries(this.piiAfter)),
      lengthHistogram: LENGTH_BUCKETS.map((upTo, index) => ({
        upTo: Number.isFinite(upTo) ? upTo : -1,
        rows: this.tokens.filter(
          (value) => value <= upTo && (index === 0 || value > LENGTH_BUCKETS[index - 1]),
        ).length,
      })),
      splits: (["train", "validation", "test"] as const).map((name) => ({
        name,
        rows: this.splits[name].rows,
        tokens: this.splits[name].tokens,
      })),
    };
  }
}
