import type { ModelConfigItem } from "../models";
import { cacheMultipliersForProvider } from "./cache-multipliers";
import type { RateEntry } from "./rates";
import type { UsageUnit } from "./units";

export const MODEL_RATES_DEFAULT_EFFECTIVE_FROM = "1970-01-01";

const TOKENS_PER_COST_UNIT = 1000;
const SECONDS_PER_HOUR = 3600;

export type ModelRateOptions = {
  resource?: string;
  effectiveFrom?: string;
};

function usdToMicros(usd: number): number {
  return usd * 1e6;
}

function perTokenMicros(costPer1k: number): number {
  return usdToMicros(costPer1k) / TOKENS_PER_COST_UNIT;
}

function isPositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function modelRateResource(model: ModelConfigItem): string {
  return model.id ?? model.matchingModel;
}

export function rateEntriesFromModelConfig(
  model: ModelConfigItem,
  options: ModelRateOptions = {},
): RateEntry[] {
  const vendor = model.provider;
  const resource = options.resource ?? modelRateResource(model);
  const effectiveFrom = options.effectiveFrom ?? MODEL_RATES_DEFAULT_EFFECTIVE_FROM;
  const entries: RateEntry[] = [];

  const push = (unit: UsageUnit, perUnitMicros: number, tier?: string) => {
    entries.push({
      vendor,
      resource,
      unit,
      perUnitMicros,
      effectiveFrom,
      ...(tier ? { tier } : {}),
    });
  };

  const inputPerToken = isPositive(model.costPer1kInputTokens)
    ? perTokenMicros(model.costPer1kInputTokens)
    : null;
  const outputPerToken = isPositive(model.costPer1kOutputTokens)
    ? perTokenMicros(model.costPer1kOutputTokens)
    : null;

  if (inputPerToken !== null) {
    push("input_tokens", inputPerToken);
  }

  if (outputPerToken !== null) {
    push("output_tokens", outputPerToken);
  }

  if (isPositive(model.costPer1kReasoningTokens)) {
    push("reasoning_tokens", perTokenMicros(model.costPer1kReasoningTokens));
  }

  const multipliers = cacheMultipliersForProvider(vendor);

  const cachedInputPerToken = isPositive(model.costPer1kCachedInputTokens)
    ? perTokenMicros(model.costPer1kCachedInputTokens)
    : inputPerToken !== null
      ? inputPerToken * multipliers.cacheRead
      : null;

  if (cachedInputPerToken !== null) {
    push("cached_input_tokens", cachedInputPerToken);
  }

  const cacheWrite5mPerToken = isPositive(model.costPer1kCacheWrite5mTokens)
    ? perTokenMicros(model.costPer1kCacheWrite5mTokens)
    : inputPerToken !== null
      ? inputPerToken * multipliers.cacheWrite5m
      : null;

  if (cacheWrite5mPerToken !== null) {
    push("cache_write_5m_tokens", cacheWrite5mPerToken);
  }

  const cacheWrite1hPerToken = isPositive(model.costPer1kCacheWrite1hTokens)
    ? perTokenMicros(model.costPer1kCacheWrite1hTokens)
    : inputPerToken !== null
      ? inputPerToken * multipliers.cacheWrite1h
      : null;

  if (cacheWrite1hPerToken !== null) {
    push("cache_write_1h_tokens", cacheWrite1hPerToken);
  }

  if (isPositive(model.costPer1kAudioInputTokens)) {
    push("audio_input_tokens", perTokenMicros(model.costPer1kAudioInputTokens));
  }

  if (isPositive(model.costPer1kAudioOutputTokens)) {
    push("audio_output_tokens", perTokenMicros(model.costPer1kAudioOutputTokens));
  }

  if (isPositive(model.costPer1kImageInputTokens)) {
    push("image_input_tokens", perTokenMicros(model.costPer1kImageInputTokens));
  }

  if (isPositive(model.costPer1kVideoInputTokens)) {
    push("video_input_tokens", perTokenMicros(model.costPer1kVideoInputTokens));
  }

  if (isPositive(model.costPer1kSearches)) {
    push("search_queries", usdToMicros(model.costPer1kSearches) / TOKENS_PER_COST_UNIT);
  }

  if (isPositive(model.costPerCodeExecutionHour)) {
    push("code_execution_seconds", usdToMicros(model.costPerCodeExecutionHour) / SECONDS_PER_HOUR);
  }

  if (isPositive(model.costPerImage)) {
    push("images", usdToMicros(model.costPerImage));
  }

  if (isPositive(model.costPerVideoSecond)) {
    push("video_seconds", usdToMicros(model.costPerVideoSecond));
  }

  if (isPositive(model.costPerAudioSecond)) {
    push("audio_seconds", usdToMicros(model.costPerAudioSecond));
  }

  if (isPositive(model.costPerCharacter)) {
    push("characters", usdToMicros(model.costPerCharacter));
  }

  if (isPositive(model.costPerPage)) {
    push("pages", usdToMicros(model.costPerPage));
  }

  if (isPositive(model.costPerRun)) {
    push("requests", usdToMicros(model.costPerRun));
  }

  const tierMultipliers = model.serviceTierMultipliers;

  if (tierMultipliers) {
    const baseEntries = [...entries];

    for (const [tier, multiplier] of Object.entries(tierMultipliers)) {
      if (!isPositive(multiplier) || multiplier === 1) {
        continue;
      }

      for (const entry of baseEntries) {
        push(entry.unit, entry.perUnitMicros * multiplier, tier);
      }
    }
  }

  return entries;
}

export const HOSTED_TOOL_UNITS_BY_TOOL: Record<string, UsageUnit> = {
  web_search: "web_search_requests",
  web_fetch: "web_fetch_requests",
  file_search: "file_search_requests",
  image_generation: "image_generation_calls",
  computer_use: "computer_use_requests",
  grounding: "grounded_requests",
  live_search: "search_sources",
  search: "search_units",
};

export function hostedToolUsageUnit(tool: string): UsageUnit {
  return HOSTED_TOOL_UNITS_BY_TOOL[tool] ?? "requests";
}

export function hostedToolRateEntries(
  model: ModelConfigItem,
  options: ModelRateOptions = {},
): RateEntry[] {
  const costs = model.hostedToolCosts;

  if (!costs) {
    return [];
  }

  const effectiveFrom = options.effectiveFrom ?? MODEL_RATES_DEFAULT_EFFECTIVE_FROM;

  return Object.entries(costs)
    .filter(([, usdPerCall]) => isPositive(usdPerCall))
    .map(([tool, usdPerCall]) => ({
      vendor: model.provider,
      resource: tool,
      unit: hostedToolUsageUnit(tool),
      perUnitMicros: usdToMicros(usdPerCall),
      effectiveFrom,
    }));
}
