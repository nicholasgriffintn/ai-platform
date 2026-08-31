import type { UsageUnit } from "@ngriffin_uk/polychat-schemas";

import { findNumericFieldDeep } from "~/utils/recordFields";

import type { NormalisedTokenUsage } from "./tokenUsage";

export interface BillableQuantity {
  unit: UsageUnit;
  quantity: number;
}

export interface BillableUnitOptions {
  hasReasoningRate?: boolean;
  hasAudioRate?: boolean;
}

const ADDITIONAL_CACHE_READ_FIELDS = [
  "cache_read_input_tokens",
  "cacheReadInputTokens",
  "cacheReadInputTokenCount",
] as const;

const SUBSET_REASONING_FIELDS = ["reasoning_tokens"] as const;

function isAdditionalCacheRead(raw: unknown): boolean {
  return findNumericFieldDeep(raw, ADDITIONAL_CACHE_READ_FIELDS) !== undefined;
}

function isSubsetReasoning(raw: unknown): boolean {
  return findNumericFieldDeep(raw, SUBSET_REASONING_FIELDS) !== undefined;
}

function positive(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
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
  push("cache_write_5m_tokens", cacheWrite);

  if (chargeReasoningSeparately) {
    push("reasoning_tokens", reasoning);
  }

  if (chargeAudioSeparately) {
    push("audio_input_tokens", audioInput);
    push("audio_output_tokens", audioOutput);
  }

  return quantities;
}
