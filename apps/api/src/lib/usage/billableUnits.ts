import type { UsageUnit } from "@ngriffin_uk/polychat-schemas";

import { isRecord } from "~/utils/objects";
import { findNumericFieldDeep, readNumericField } from "~/utils/recordFields";

import type { NormalisedTokenUsage } from "./tokenUsage";

export interface BillableQuantity {
  unit: UsageUnit;
  quantity: number;
}

export interface BillableUnitOptions {
  hasReasoningRate?: boolean;
  hasAudioRate?: boolean;
  hasGenericCacheWriteRate?: boolean;
  longContextThresholdTokens?: number;
}

const ADDITIONAL_CACHE_READ_FIELDS = [
  "cache_read_input_tokens",
  "cacheReadInputTokens",
  "cacheReadInputTokenCount",
] as const;

const SUBSET_REASONING_FIELDS = ["reasoning_tokens"] as const;
const SUBSET_CACHE_WRITE_FIELDS = ["cache_write_tokens"] as const;

function isAdditionalCacheRead(raw: unknown): boolean {
  return findNumericFieldDeep(raw, ADDITIONAL_CACHE_READ_FIELDS) !== undefined;
}

function isSubsetReasoning(raw: unknown): boolean {
  return findNumericFieldDeep(raw, SUBSET_REASONING_FIELDS) !== undefined;
}

function isSubsetCacheWrite(raw: unknown): boolean {
  return findNumericFieldDeep(raw, SUBSET_CACHE_WRITE_FIELDS) !== undefined;
}

function positive(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

interface CacheWriteSplit {
  fiveMinute: number;
  oneHour: number;
}

function splitCacheWriteTiers(raw: unknown, totalCacheWrite: number): CacheWriteSplit {
  if (!isRecord(raw) || !isRecord(raw.cache_creation)) {
    return { fiveMinute: totalCacheWrite, oneHour: 0 };
  }

  const breakdown = raw.cache_creation;
  const fiveMinute = positive(readNumericField(breakdown, "ephemeral_5m_input_tokens"));
  const oneHour = positive(readNumericField(breakdown, "ephemeral_1h_input_tokens"));

  if (fiveMinute === 0 && oneHour === 0) {
    return { fiveMinute: totalCacheWrite, oneHour: 0 };
  }

  const unaccounted = Math.max(0, totalCacheWrite - fiveMinute - oneHour);

  return { fiveMinute: fiveMinute + unaccounted, oneHour };
}

export function billableTokenQuantities(
  usage: NormalisedTokenUsage,
  raw: unknown,
  options: BillableUnitOptions = {},
): BillableQuantity[] {
  const cachedInput = positive(usage.cached_input_tokens);
  const cacheWrite = positive(usage.cache_creation_tokens);
  const reasoning = positive(usage.reasoning_tokens);
  const audioInput = positive(usage.audio_input_tokens);
  const audioOutput = positive(usage.audio_output_tokens);

  let inputTokens = positive(usage.input_tokens);
  let outputTokens = positive(usage.output_tokens);

  if (cachedInput > 0 && !isAdditionalCacheRead(raw)) {
    inputTokens = Math.max(0, inputTokens - cachedInput);
  }

  if (cacheWrite > 0 && options.hasGenericCacheWriteRate === true && isSubsetCacheWrite(raw)) {
    inputTokens = Math.max(0, inputTokens - cacheWrite);
  }

  const chargeReasoningSeparately = options.hasReasoningRate === true && reasoning > 0;

  if (chargeReasoningSeparately && isSubsetReasoning(raw)) {
    outputTokens = Math.max(0, outputTokens - reasoning);
  }

  const chargeAudioSeparately = options.hasAudioRate === true;

  if (chargeAudioSeparately) {
    inputTokens = Math.max(0, inputTokens - audioInput);
    outputTokens = Math.max(0, outputTokens - audioOutput);
  }

  const quantities: BillableQuantity[] = [];

  const push = (unit: UsageUnit, quantity: number) => {
    if (quantity > 0) {
      quantities.push({ unit, quantity });
    }
  };

  push("input_tokens", inputTokens);
  push("output_tokens", outputTokens);
  push("cached_input_tokens", cachedInput);

  if (options.hasGenericCacheWriteRate) {
    push("cache_write_tokens", cacheWrite);
  } else {
    const cacheWriteSplit = splitCacheWriteTiers(raw, cacheWrite);

    push("cache_write_5m_tokens", cacheWriteSplit.fiveMinute);
    push("cache_write_1h_tokens", cacheWriteSplit.oneHour);
  }

  if (chargeReasoningSeparately) {
    push("reasoning_tokens", reasoning);
  }

  if (chargeAudioSeparately) {
    push("audio_input_tokens", audioInput);
    push("audio_output_tokens", audioOutput);
  }

  const longContextThreshold = options.longContextThresholdTokens;

  if (longContextThreshold === undefined || positive(usage.input_tokens) <= longContextThreshold) {
    return quantities;
  }

  const longContextUnits: Partial<Record<UsageUnit, UsageUnit>> = {
    input_tokens: "long_context_input_tokens",
    output_tokens: "long_context_output_tokens",
    cached_input_tokens: "long_context_cached_input_tokens",
    cache_write_tokens: "long_context_cache_write_tokens",
  };

  return quantities.map((quantity) => ({
    unit: longContextUnits[quantity.unit] ?? quantity.unit,
    quantity: quantity.quantity,
  }));
}
