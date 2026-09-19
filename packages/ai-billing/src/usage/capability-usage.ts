import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  modelRateResource,
  rateEntriesFromModelConfig,
  type UsageUnit,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";
import {
  findNumericFieldDeep,
  readNumericField,
  readStringField,
} from "@ngriffin_uk/polychat-utility-server/record-fields";

import { userCreditActor } from "./credit-actor.js";
import { emitUsageEvents, resolveUsageAttribution, type UsageEventDraft } from "./ledger.js";
import { isByokTurn } from "./model-usage.js";
import type { UsageRuntime } from "./store.js";

const logger = getLogger({ prefix: "ai-billing/capability-usage" });

export interface CapabilityMeasurement {
  unit: UsageUnit;
  quantity: number;
}

export type CapabilityQuantityExtractor = (
  args: readonly unknown[],
  result: unknown,
) => CapabilityMeasurement | null;

export type CapabilityMeterTable = Record<string, Record<string, CapabilityQuantityExtractor>>;

const FALLBACK_MEASUREMENT: CapabilityMeasurement = { unit: "requests", quantity: 1 };

function positive(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function stringLength(args: readonly unknown[], field: string): number | null {
  const request = args[0];

  if (!isRecord(request) || typeof request[field] !== "string") {
    return null;
  }

  return positive(request[field].length);
}

function requestSeconds(args: readonly unknown[], fields: readonly string[]): number | null {
  const request = args[0];

  if (!isRecord(request)) {
    return null;
  }

  for (const field of fields) {
    const value = positive(readNumericField(request, field));

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function measure(unit: UsageUnit, quantity: number | null): CapabilityMeasurement | null {
  return quantity === null ? null : { unit, quantity };
}

export const DEFAULT_CAPABILITY_METERS: CapabilityMeterTable = {
  audio: {
    synthesize: (args) => measure("characters", stringLength(args, "input")),
  },
  decision: {
    decide: (_args, result) =>
      measure(
        "input_tokens",
        isRecord(result) ? positive(findNumericFieldDeep(result, ["input_tokens"], 2)) : null,
      ),
  },
  embedding: {
    generate: () => null,
  },
  guardrails: {
    validateContent: () => null,
  },
  image: {
    generate: () => ({ unit: "images", quantity: 1 }),
  },
  memory: {
    storeMemory: () => null,
    retrieveMemories: () => null,
  },
  messaging: {
    send: () => null,
  },
  music: {
    generate: (args) => measure("audio_seconds", requestSeconds(args, ["duration"])),
  },
  ocr: {
    extractText: (_args, result) =>
      measure(
        "pages",
        isRecord(result) ? positive(findNumericFieldDeep(result, ["pagesProcessed"], 4)) : null,
      ),
  },
  realtime: {
    createSession: () => null,
  },
  research: {
    createResearchTask: () => null,
    performResearch: () => null,
  },
  search: {
    performWebSearch: () => ({ unit: "search_queries", quantity: 1 }),
  },
  speech: {
    generate: (args) => measure("speech_characters", stringLength(args, "prompt")),
  },
  transcription: {
    transcribe: (_args, result) =>
      measure(
        "transcription_seconds",
        isRecord(result)
          ? positive(
              findNumericFieldDeep(result, ["duration", "duration_seconds", "durationSeconds"], 4),
            )
          : null,
      ),
  },
  video: {
    generate: (args) => measure("video_seconds", requestSeconds(args, ["duration", "videoLength"])),
  },
};

function requestModel(args: readonly unknown[], result: unknown): string | undefined {
  const request = args[0];
  const fromRequest = isRecord(request) ? readStringField(request, "model") : undefined;

  if (fromRequest) {
    return fromRequest;
  }

  return isRecord(result) ? readStringField(result, "model") : undefined;
}

function requestStringField(args: readonly unknown[], field: string): string | null {
  const request = args[0];
  const value = isRecord(request) ? readStringField(request, field) : undefined;

  return value ?? null;
}

export interface RecordCapabilityCallParams {
  category: string;
  providerName: string;
  userId: number;
  runId?: string;
  runAttempt?: number;
  args: readonly unknown[];
  result: unknown;
  extractor: CapabilityQuantityExtractor;
}

export async function recordCapabilityCall(
  runtime: UsageRuntime,
  params: RecordCapabilityCallParams,
): Promise<void> {
  try {
    const measurement = params.extractor(params.args, params.result) ?? FALLBACK_MEASUREMENT;

    if (!(measurement.quantity > 0)) {
      return;
    }

    const model = requestModel(params.args, params.result);
    const modelConfig = model ? await runtime.resolveModelConfig?.(model) : undefined;
    const vendor = modelConfig?.provider ?? params.providerName;
    const resource = modelConfig ? modelRateResource(modelConfig) : (model ?? params.category);
    const rates = modelConfig ? rateEntriesFromModelConfig(modelConfig, { resource }) : [];
    const conversationId = requestStringField(params.args, "conversationId");
    const completionId = requestStringField(params.args, "completion_id");

    const [byok, attribution] = await Promise.all([
      isByokTurn(runtime.store, params.userId, params.providerName),
      resolveUsageAttribution(runtime.store, conversationId),
    ]);

    const draft: UsageEventDraft = {
      idempotencyKey: `capability:${params.category}:${generateId()}`,
      actor: userCreditActor(params.userId),
      source: "capability",
      vendor,
      resource,
      unit: measurement.unit,
      quantity: measurement.quantity,
      byok,
      conversationId,
      completionId,
      projectId: attribution.projectId ?? requestStringField(params.args, "projectId"),
      workspaceId: attribution.workspaceId,
      rates,
      runId: params.runId ?? null,
      runAttempt: params.runAttempt ?? null,
    };

    await emitUsageEvents(runtime, { drafts: [draft] });
  } catch (error) {
    logger.warn("Failed to record capability usage", {
      error,
      category: params.category,
      provider: params.providerName,
    });
  }
}
