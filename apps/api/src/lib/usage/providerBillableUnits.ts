import { hostedToolUsageUnit, type UsageUnit } from "@ngriffin_uk/polychat-schemas";

import type { MessagePart } from "~/types";
import { isRecord } from "~/utils/objects";
import { readNumericField, readStringField } from "~/utils/recordFields";

import { billableTokenQuantities } from "./billableUnits";
import type { NormalisedTokenUsage } from "./tokenUsage";

export type BillableUnitSource = "model" | "hosted_tool";

export interface ProviderBillableUnit {
  unit: UsageUnit;
  quantity: number;
  source: BillableUnitSource;
  resource?: string;
}

export interface ProviderUsageSignals {
  usage: NormalisedTokenUsage | null;
  raw: unknown;
  parts?: readonly MessagePart[];
  structuredData?: unknown;
  serviceTier?: string;
}

export interface ProviderUsageOptions {
  hasRate: (unit: UsageUnit) => boolean;
}

export interface ProviderUsageExtraction {
  units: ProviderBillableUnit[];
  tier?: string;
}

type ProviderExtractor = (
  units: ProviderBillableUnit[],
  signals: ProviderUsageSignals,
  options: ProviderUsageOptions,
) => ProviderBillableUnit[];

const USD_MICROS_PER_USD = 1_000_000;

function pushHostedTool(units: ProviderBillableUnit[], tool: string, quantity: number): void {
  if (quantity > 0) {
    units.push({
      unit: hostedToolUsageUnit(tool),
      quantity,
      source: "hosted_tool",
      resource: tool,
    });
  }
}

function findUnit(
  units: ProviderBillableUnit[],
  unit: UsageUnit,
): ProviderBillableUnit | undefined {
  return units.find((entry) => entry.unit === unit && entry.source === "model");
}

function addToUnit(units: ProviderBillableUnit[], unit: UsageUnit, quantity: number): void {
  if (quantity <= 0) {
    return;
  }

  const existing = findUnit(units, unit);

  if (existing) {
    existing.quantity += quantity;

    return;
  }

  units.push({ unit, quantity, source: "model" });
}

function subtractFromUnit(units: ProviderBillableUnit[], unit: UsageUnit, quantity: number): void {
  const existing = findUnit(units, unit);

  if (existing) {
    existing.quantity = Math.max(0, existing.quantity - quantity);
  }
}

function positiveField(value: unknown, field: string): number {
  const parsed = readNumericField(value, field);

  return parsed !== undefined && parsed > 0 ? parsed : 0;
}

const anthropicExtractor: ProviderExtractor = (units, signals) => {
  const raw = signals.raw;

  if (!isRecord(raw)) {
    return units;
  }

  const serverToolUse = isRecord(raw.server_tool_use) ? raw.server_tool_use : undefined;

  if (serverToolUse) {
    pushHostedTool(units, "web_search", positiveField(serverToolUse, "web_search_requests"));
    pushHostedTool(units, "web_fetch", positiveField(serverToolUse, "web_fetch_requests"));

    const executionSeconds =
      positiveField(serverToolUse, "execution_time_seconds") ||
      positiveField(serverToolUse, "code_execution_seconds");

    if (executionSeconds > 0) {
      units.push({
        unit: "code_execution_seconds",
        quantity: executionSeconds,
        source: "hosted_tool",
      });
    }
  }

  return units;
};

const OPENAI_HOSTED_TOOL_RESOURCES_BY_PART_NAME: Record<string, string> = {
  search_grounding: "web_search",
  file_search: "file_search",
  image_generation: "image_generation",
  computer_use: "computer_use",
};

const openaiExtractor: ProviderExtractor = (units, signals) => {
  const counts = new Map<string, number>();
  let usedCodeInterpreter = false;

  for (const part of signals.parts ?? []) {
    if (part.type !== "tool_use") {
      continue;
    }

    if (part.name === "code_execution") {
      usedCodeInterpreter = true;
      continue;
    }

    const tool = OPENAI_HOSTED_TOOL_RESOURCES_BY_PART_NAME[part.name];

    if (tool) {
      counts.set(tool, (counts.get(tool) ?? 0) + 1);
    }
  }

  for (const [tool, count] of counts) {
    pushHostedTool(units, tool, count);
  }

  if (usedCodeInterpreter) {
    pushHostedTool(units, "code_interpreter", 1);
  }

  return units;
};

const GOOGLE_MODALITY_UNITS: Record<string, UsageUnit> = {
  IMAGE: "image_input_tokens",
  AUDIO: "audio_input_tokens",
  VIDEO: "video_input_tokens",
};

const googleExtractor: ProviderExtractor = (units, signals, options) => {
  const raw = signals.raw;

  if (isRecord(raw)) {
    const modalityDetails = Array.isArray(raw.promptTokensDetails) ? raw.promptTokensDetails : [];

    for (const detail of modalityDetails) {
      if (!isRecord(detail)) {
        continue;
      }

      const modality = readStringField(detail, "modality");
      const unit = modality ? GOOGLE_MODALITY_UNITS[modality] : undefined;
      const tokenCount = positiveField(detail, "tokenCount");

      if (!unit || tokenCount === 0 || !options.hasRate(unit)) {
        continue;
      }

      subtractFromUnit(units, "input_tokens", tokenCount);
      addToUnit(units, unit, tokenCount);
    }

    const toolUseTokens = positiveField(raw, "toolUsePromptTokenCount");

    if (toolUseTokens > 0) {
      addToUnit(
        units,
        options.hasRate("tool_use_prompt_tokens") ? "tool_use_prompt_tokens" : "input_tokens",
        toolUseTokens,
      );
    }
  }

  const structuredData = signals.structuredData;

  if (isRecord(structuredData) && isRecord(structuredData.searchGrounding)) {
    pushHostedTool(units, "grounding", 1);
  }

  return units;
};

const xaiExtractor: ProviderExtractor = (units, signals) => {
  pushHostedTool(units, "live_search", positiveField(signals.raw, "num_sources_used"));

  return units;
};

const perplexityExtractor: ProviderExtractor = (units, signals) => {
  const raw = signals.raw;

  if (!isRecord(raw)) {
    return units;
  }

  const citationTokens = positiveField(raw, "citation_tokens");

  if (citationTokens > 0) {
    const promptTokens = positiveField(raw, "prompt_tokens");
    const completionTokens = positiveField(raw, "completion_tokens");
    const totalTokens = positiveField(raw, "total_tokens");
    const alreadyCounted = promptTokens + completionTokens + citationTokens <= totalTokens;

    if (!alreadyCounted) {
      addToUnit(units, "output_tokens", citationTokens);
    }
  }

  const searchQueries = positiveField(raw, "num_search_queries");

  if (searchQueries > 0) {
    units.push({ unit: "search_queries", quantity: searchQueries, source: "hosted_tool" });
  }

  return units;
};

const cohereExtractor: ProviderExtractor = (units, signals) => {
  const raw = signals.raw;
  const billedUnits = isRecord(raw) && isRecord(raw.billed_units) ? raw.billed_units : undefined;

  pushHostedTool(units, "search", positiveField(billedUnits, "search_units"));

  return units;
};

const openrouterExtractor: ProviderExtractor = (units, signals) => {
  const raw = signals.raw;

  if (!isRecord(raw)) {
    return units;
  }

  const cost = readNumericField(raw, "cost");

  if (cost === undefined || cost < 0) {
    return units;
  }

  const costDetails = isRecord(raw.cost_details) ? raw.cost_details : undefined;
  const upstreamCost =
    raw.is_byok === true ? positiveField(costDetails, "upstream_inference_cost") : 0;
  const usdMicros = Math.round((cost + upstreamCost) * USD_MICROS_PER_USD);

  if (usdMicros === 0) {
    return units;
  }

  return [{ unit: "usd_micros", quantity: usdMicros, source: "model" }];
};

const replicateExtractor: ProviderExtractor = (units, signals, options) => {
  const raw = signals.raw;
  const metrics = isRecord(raw) && isRecord(raw.metrics) ? raw.metrics : undefined;

  if (metrics && positiveField(metrics, "predict_time") > 0 && options.hasRate("requests")) {
    addToUnit(units, "requests", 1);
  }

  return units;
};

const PROVIDER_EXTRACTORS: Record<string, ProviderExtractor> = {
  anthropic: anthropicExtractor,
  openai: openaiExtractor,
  "google-ai-studio": googleExtractor,
  "google-vertex": googleExtractor,
  grok: xaiExtractor,
  "perplexity-ai": perplexityExtractor,
  cohere: cohereExtractor,
  openrouter: openrouterExtractor,
  replicate: replicateExtractor,
};

export function extractProviderBillableUsage(
  provider: string,
  signals: ProviderUsageSignals,
  options: ProviderUsageOptions,
): ProviderUsageExtraction {
  const baseQuantities = signals.usage
    ? billableTokenQuantities(signals.usage, signals.raw, {
        hasReasoningRate: options.hasRate("reasoning_tokens"),
        hasAudioRate:
          options.hasRate("audio_input_tokens") || options.hasRate("audio_output_tokens"),
      })
    : [];

  let units: ProviderBillableUnit[] = baseQuantities.map(({ unit, quantity }) => ({
    unit,
    quantity,
    source: "model",
  }));

  const extractor = PROVIDER_EXTRACTORS[provider.trim().toLowerCase()];

  if (extractor) {
    units = extractor(units, signals, options);
  }

  const tier =
    (isRecord(signals.raw) ? readStringField(signals.raw, "service_tier") : undefined) ??
    signals.serviceTier;

  return {
    units: units.filter((entry) => entry.quantity > 0),
    ...(tier ? { tier } : {}),
  };
}
