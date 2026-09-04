import { isRecord } from "~/utils/objects";
import { readNumericField } from "~/utils/recordFields";

export type NormalisedTokenUsage = {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cached_input_tokens?: number;
  cache_creation_tokens?: number;
  reasoning_tokens?: number;
  audio_input_tokens?: number;
  audio_output_tokens?: number;
};

const INPUT_TOKEN_FIELDS = [
  "prompt_tokens",
  "input_tokens",
  "promptTokenCount",
  "inputTokens",
  "inputTokenCount",
  "prompt_eval_count",
  "promptTokens",
] as const;

const OUTPUT_TOKEN_FIELDS = [
  "completion_tokens",
  "output_tokens",
  "candidatesTokenCount",
  "outputTokens",
  "outputTokenCount",
  "eval_count",
  "completionTokens",
] as const;

const TOTAL_TOKEN_FIELDS = ["total_tokens", "totalTokens", "totalTokenCount"] as const;

const CACHED_INPUT_SUBSET_FIELDS = [
  "cached_tokens",
  "cachedContentTokenCount",
  "prompt_cache_hit_tokens",
] as const;

const CACHED_INPUT_ADDITIONAL_FIELDS = [
  "cache_read_input_tokens",
  "cacheReadInputTokens",
  "cacheReadInputTokenCount",
] as const;

const CACHE_CREATION_FIELDS = [
  "cache_creation_input_tokens",
  "cacheWriteInputTokens",
  "cacheWriteInputTokenCount",
] as const;

const CACHE_WRITE_SUBSET_FIELDS = ["cache_write_tokens"] as const;

const REASONING_TOKEN_FIELDS = ["reasoning_tokens", "thoughtsTokenCount"] as const;

const AUDIO_TOKEN_FIELD = "audio_tokens";

const INPUT_DETAIL_CONTAINERS = ["prompt_tokens_details", "input_tokens_details"] as const;
const OUTPUT_DETAIL_CONTAINERS = ["completion_tokens_details", "output_tokens_details"] as const;
const NESTED_USAGE_CONTAINERS = ["tokens", "billed_units", "usage", "usageMetadata"] as const;

const RECOGNISED_TOKEN_FIELDS: readonly string[] = [
  ...INPUT_TOKEN_FIELDS,
  ...OUTPUT_TOKEN_FIELDS,
  ...TOTAL_TOKEN_FIELDS,
  ...CACHED_INPUT_ADDITIONAL_FIELDS,
  ...CACHE_CREATION_FIELDS,
];

function readAlias(
  sources: Record<string, unknown>[],
  fields: readonly string[],
): number | undefined {
  for (const source of sources) {
    for (const field of fields) {
      const value = readNumericField(source, field);

      if (value !== undefined) {
        return value;
      }
    }
  }

  return undefined;
}

function collectSources(usage: Record<string, unknown>): Record<string, unknown>[] {
  const sources: Record<string, unknown>[] = [usage];

  for (const container of NESTED_USAGE_CONTAINERS) {
    const nested = usage[container];

    if (isRecord(nested)) {
      sources.push(nested);
    }
  }

  return sources;
}

function collectDetailSources(
  sources: Record<string, unknown>[],
  containers: readonly string[],
): Record<string, unknown>[] {
  const details: Record<string, unknown>[] = [];

  for (const source of sources) {
    for (const container of containers) {
      const nested = source[container];

      if (isRecord(nested)) {
        details.push(nested);
      }
    }
  }

  return details;
}

function sumCacheCreation(sources: Record<string, unknown>[]): number | undefined {
  const direct = readAlias(sources, CACHE_CREATION_FIELDS);

  if (direct !== undefined) {
    return direct;
  }

  for (const source of sources) {
    const breakdown = source.cache_creation;

    if (!isRecord(breakdown)) {
      continue;
    }

    const total = Object.values(breakdown).reduce<number>(
      (sum, value) => (typeof value === "number" && Number.isFinite(value) ? sum + value : sum),
      0,
    );

    return total;
  }

  return undefined;
}

export function hasRecognisedTokenFields(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  const sources = collectSources(value);

  return sources.some((source) =>
    RECOGNISED_TOKEN_FIELDS.some((field) => readNumericField(source, field) !== undefined),
  );
}

export function normaliseTokenUsage(value: unknown): NormalisedTokenUsage | null {
  if (!isRecord(value)) {
    return null;
  }

  const sources = collectSources(value);
  const inputDetails = collectDetailSources(sources, INPUT_DETAIL_CONTAINERS);
  const outputDetails = collectDetailSources(sources, OUTPUT_DETAIL_CONTAINERS);

  const rawInput = readAlias(sources, INPUT_TOKEN_FIELDS);
  const rawOutput = readAlias(sources, OUTPUT_TOKEN_FIELDS);
  const rawTotal = readAlias(sources, TOTAL_TOKEN_FIELDS);
  const cachedSubset = readAlias([...inputDetails, ...sources], CACHED_INPUT_SUBSET_FIELDS);
  const cachedAdditional = readAlias(sources, CACHED_INPUT_ADDITIONAL_FIELDS);
  const additionalCacheCreation = sumCacheCreation(sources);
  const cacheWriteSubset = readAlias(inputDetails, CACHE_WRITE_SUBSET_FIELDS);
  const cacheCreation = additionalCacheCreation ?? cacheWriteSubset;
  const reasoning = readAlias([...outputDetails, ...sources], REASONING_TOKEN_FIELDS);
  const audioInput = readAlias(inputDetails, [AUDIO_TOKEN_FIELD]);
  const audioOutput = readAlias(outputDetails, [AUDIO_TOKEN_FIELD]);

  if (
    rawInput === undefined &&
    rawOutput === undefined &&
    rawTotal === undefined &&
    cachedAdditional === undefined &&
    cacheCreation === undefined
  ) {
    return null;
  }

  const inputTokens = rawInput ?? 0;
  const outputTokens = rawOutput ?? 0;
  const uncountedInput = (cachedAdditional ?? 0) + (additionalCacheCreation ?? 0);
  const totalTokens = Math.max(rawTotal ?? 0, inputTokens + outputTokens + uncountedInput);
  const cachedInput = cachedAdditional ?? cachedSubset;

  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    prompt_tokens: inputTokens,
    completion_tokens: outputTokens,
    ...(cachedInput !== undefined ? { cached_input_tokens: cachedInput } : {}),
    ...(cacheCreation !== undefined ? { cache_creation_tokens: cacheCreation } : {}),
    ...(reasoning !== undefined ? { reasoning_tokens: reasoning } : {}),
    ...(audioInput !== undefined ? { audio_input_tokens: audioInput } : {}),
    ...(audioOutput !== undefined ? { audio_output_tokens: audioOutput } : {}),
  };
}

const OPTIONAL_USAGE_FIELDS = [
  "cached_input_tokens",
  "cache_creation_tokens",
  "reasoning_tokens",
  "audio_input_tokens",
  "audio_output_tokens",
] as const;

function combineTokenUsage(
  previous: unknown,
  next: unknown,
  combine: (a: number, b: number) => number,
): NormalisedTokenUsage | null {
  const left = normaliseTokenUsage(previous);
  const right = normaliseTokenUsage(next);

  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  const merged: NormalisedTokenUsage = {
    input_tokens: combine(left.input_tokens, right.input_tokens),
    output_tokens: combine(left.output_tokens, right.output_tokens),
    total_tokens: combine(left.total_tokens, right.total_tokens),
    prompt_tokens: 0,
    completion_tokens: 0,
  };

  merged.prompt_tokens = merged.input_tokens;
  merged.completion_tokens = merged.output_tokens;

  for (const field of OPTIONAL_USAGE_FIELDS) {
    const leftValue = left[field];
    const rightValue = right[field];

    if (leftValue === undefined && rightValue === undefined) {
      continue;
    }

    merged[field] = combine(leftValue ?? 0, rightValue ?? 0);
  }

  merged.total_tokens = Math.max(merged.total_tokens, merged.input_tokens + merged.output_tokens);

  return merged;
}

export function mergeStreamedTokenUsage(
  previous: unknown,
  next: unknown,
): NormalisedTokenUsage | null {
  return combineTokenUsage(previous, next, Math.max);
}

export function hasTokenUsageChanged(
  previous: NormalisedTokenUsage | null,
  next: NormalisedTokenUsage | null,
): boolean {
  if (!next) {
    return false;
  }

  if (!previous) {
    return true;
  }

  return (
    previous.input_tokens !== next.input_tokens ||
    previous.output_tokens !== next.output_tokens ||
    previous.total_tokens !== next.total_tokens
  );
}

export function sumTokenUsage(previous: unknown, next: unknown): NormalisedTokenUsage | null {
  return combineTokenUsage(previous, next, (a, b) => a + b);
}
