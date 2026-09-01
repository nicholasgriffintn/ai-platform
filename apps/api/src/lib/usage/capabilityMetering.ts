import {
  modelRateResource,
  rateEntriesFromModelConfig,
  type UsageUnit,
} from "@ngriffin_uk/polychat-schemas";

import { getModelConfig } from "~/lib/providers/models";
import type { ProviderCategory, ProviderFactoryContext } from "~/lib/providers/registry/types";
import { RepositoryManager } from "~/repositories";
import type { IEnv } from "~/types";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import { isRecord } from "~/utils/objects";
import { findNumericFieldDeep, readNumericField, readStringField } from "~/utils/recordFields";

import { userCreditActor } from "./creditActor";
import { emitUsageEvents, resolveUsageAttribution, type UsageEventDraft } from "./ledger";

const logger = getLogger({ prefix: "lib/usage/capability-metering" });

interface CapabilityMeasurement {
  unit: UsageUnit;
  quantity: number;
}

type QuantityExtractor = (
  args: readonly unknown[],
  result: unknown,
) => CapabilityMeasurement | null;

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

const METERED_METHODS: Partial<Record<ProviderCategory, Record<string, QuantityExtractor>>> = {
  audio: {
    synthesize: (args) => measure("characters", stringLength(args, "input")),
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

async function resolveByok(
  repositories: RepositoryManager,
  userId: number,
  provider: string,
): Promise<boolean> {
  try {
    return await repositories.userSettings.hasProviderApiKey(userId, provider);
  } catch (error) {
    logger.warn("Failed to resolve BYOK state for a capability event", {
      error,
      userId,
      provider,
    });

    return false;
  }
}

interface RecordCapabilityCallParams {
  category: ProviderCategory;
  providerName: string;
  env: IEnv;
  userId: number;
  serviceRepositories?: RepositoryManager;
  args: readonly unknown[];
  result: unknown;
  extractor: QuantityExtractor;
}

async function recordCapabilityCall(params: RecordCapabilityCallParams): Promise<void> {
  try {
    const measurement = params.extractor(params.args, params.result) ?? FALLBACK_MEASUREMENT;

    if (!(measurement.quantity > 0)) {
      return;
    }

    const repositories = params.serviceRepositories ?? new RepositoryManager(params.env);
    const model = requestModel(params.args, params.result);
    const modelConfig = model ? await getModelConfig(model, params.env) : undefined;
    const vendor = modelConfig?.provider ?? params.providerName;
    const resource = modelConfig ? modelRateResource(modelConfig) : (model ?? params.category);
    const rates = modelConfig ? rateEntriesFromModelConfig(modelConfig, { resource }) : [];
    const conversationId = requestStringField(params.args, "conversationId");
    const completionId = requestStringField(params.args, "completion_id");

    const [byok, attribution] = await Promise.all([
      resolveByok(repositories, params.userId, params.providerName),
      resolveUsageAttribution(repositories, conversationId),
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
    };

    await emitUsageEvents({ env: params.env, repositories, drafts: [draft] });
  } catch (error) {
    logger.warn("Failed to record capability usage", {
      error,
      category: params.category,
      provider: params.providerName,
    });
  }
}

export function withCapabilityMetering<T>(
  category: ProviderCategory,
  providerName: string,
  instance: T,
  context: ProviderFactoryContext | undefined,
): T {
  const methods = METERED_METHODS[category];
  const env = context?.serviceContext?.env ?? context?.env;
  const userId = context?.user?.id ?? context?.serviceContext?.user?.id;

  if (
    !methods ||
    !env?.DB ||
    typeof userId !== "number" ||
    instance === null ||
    typeof instance !== "object"
  ) {
    return instance;
  }

  const target = instance as object;
  const canonicalName =
    typeof (target as { name?: unknown }).name === "string"
      ? (target as { name: string }).name
      : providerName;
  const serviceRepositories = context?.serviceContext?.repositories;

  return new Proxy(target, {
    get(currentTarget, prop) {
      const value = Reflect.get(currentTarget, prop);

      if (typeof value !== "function") {
        return value;
      }

      const extractor = typeof prop === "string" ? methods[prop] : undefined;

      if (!extractor) {
        return value.bind(currentTarget);
      }

      return async (...args: unknown[]) => {
        const result = await value.apply(currentTarget, args);

        await recordCapabilityCall({
          category,
          providerName: canonicalName,
          env,
          userId,
          serviceRepositories,
          args,
          result,
          extractor,
        });

        return result;
      };
    },
  }) as T;
}
