import {
  modelRateResource,
  rateEntriesFromModelConfig,
  type RateEntry,
} from "@ngriffin_uk/polychat-schemas";

import { getModelConfig } from "~/lib/providers/models";
import { RepositoryManager } from "~/repositories";
import type { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";

import { billableTokenQuantities } from "./billableUnits";
import { emitUsageEvents, resolveUsageAttribution, type UsageEventDraft } from "./ledger";
import type { NormalisedTokenUsage } from "./tokenUsage";

const logger = getLogger({ prefix: "lib/usage/model-usage" });

export interface RecordModelTurnUsageParams {
  env: IEnv;
  repositories?: RepositoryManager;
  userId?: number;
  usage: NormalisedTokenUsage | null;
  rawUsage?: unknown;
  model: string;
  provider: string;
  completionId: string;
  messageId?: string | null;
  conversationId?: string | null;
  occurredAt?: string;
  tier?: string;
}

async function isByokTurn(
  repositories: RepositoryManager,
  userId: number,
  provider: string,
): Promise<boolean> {
  try {
    return await repositories.userSettings.hasProviderApiKey(userId, provider);
  } catch (error) {
    logger.warn("Failed to resolve BYOK state for a usage event", { error, userId, provider });

    return false;
  }
}

function hasRateFor(rates: readonly RateEntry[], unit: RateEntry["unit"]): boolean {
  return rates.some((rate) => rate.unit === unit);
}

export async function recordModelTurnUsage(params: RecordModelTurnUsageParams): Promise<void> {
  const { env, usage, userId } = params;

  if (!userId || !usage || !env?.DB) {
    return;
  }

  try {
    const repositories = params.repositories ?? new RepositoryManager(env);
    const modelConfig = await getModelConfig(params.model, env, params.provider, userId);
    const resource = modelConfig ? modelRateResource(modelConfig) : params.model;
    const vendor = modelConfig?.provider ?? params.provider;
    const rates = modelConfig ? rateEntriesFromModelConfig(modelConfig, { resource }) : [];

    const quantities = billableTokenQuantities(usage, params.rawUsage ?? usage, {
      hasReasoningRate: hasRateFor(rates, "reasoning_tokens"),
      hasAudioRate:
        hasRateFor(rates, "audio_input_tokens") || hasRateFor(rates, "audio_output_tokens"),
    });

    if (quantities.length === 0) {
      return;
    }

    const [byok, attribution] = await Promise.all([
      isByokTurn(repositories, userId, vendor),
      resolveUsageAttribution(repositories, params.conversationId),
    ]);

    const occurredAt = params.occurredAt ?? new Date().toISOString();
    const eventScope = params.messageId ?? params.completionId;

    const shared = {
      userId,
      source: "model" as const,
      vendor,
      resource,
      occurredAt,
      byok,
      conversationId: params.conversationId ?? null,
      messageId: params.messageId ?? null,
      completionId: params.completionId,
      projectId: attribution.projectId,
      workspaceId: attribution.workspaceId,
      rates,
      raw: params.rawUsage ?? usage,
      ...(params.tier ? { tier: params.tier } : {}),
    };

    const drafts: UsageEventDraft[] = quantities.map(({ unit, quantity }) => ({
      ...shared,
      idempotencyKey: `model:${eventScope}:${unit}`,
      unit,
      quantity,
    }));

    await emitUsageEvents({ env, repositories, drafts });
  } catch (error) {
    logger.error("Failed to record model turn usage", {
      error,
      model: params.model,
      provider: params.provider,
      completionId: params.completionId,
    });
  }
}
