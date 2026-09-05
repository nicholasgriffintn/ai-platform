import {
  hostedToolRateEntries,
  modelRateResource,
  rateEntriesFromModelConfig,
  type RateEntry,
} from "@ngriffin_uk/polychat-schemas";

import { getModelConfig } from "~/lib/providers/models";
import { RepositoryManager } from "~/repositories";
import type { IEnv, MessagePart } from "~/types";
import { getLogger } from "~/utils/logger";

import { isByokTurn } from "./byok";
import { creditActorUserId, type CreditActor } from "./creditActor";
import {
  emitUsageEvents,
  resolveUsageAttribution,
  type UsageEmissionOutcome,
  type UsageEventDraft,
} from "./ledger";
import { extractProviderBillableUsage } from "./providerBillableUnits";
import type { NormalisedTokenUsage } from "./tokenUsage";

const logger = getLogger({ prefix: "lib/usage/model-usage" });

export interface RecordModelTurnUsageParams {
  env: IEnv;
  repositories?: RepositoryManager;
  actor?: CreditActor | null;
  usage: NormalisedTokenUsage | null;
  rawUsage?: unknown;
  parts?: readonly MessagePart[];
  structuredData?: unknown;
  model: string;
  provider: string;
  completionId: string;
  messageId?: string | null;
  conversationId?: string | null;
  runId?: string | null;
  runAttempt?: number | null;
  occurredAt?: string;
  tier?: string;
}

export async function recordModelTurnUsage(
  params: RecordModelTurnUsageParams,
): Promise<UsageEmissionOutcome> {
  const { env, usage, actor } = params;

  if (!actor || !env?.DB || (!usage && params.rawUsage === undefined)) {
    return "skipped";
  }

  const userId = creditActorUserId(actor);

  try {
    const repositories = params.repositories ?? new RepositoryManager(env);
    const modelConfig = await getModelConfig(params.model, env, params.provider, userId);
    const resource = modelConfig ? modelRateResource(modelConfig) : params.model;
    const vendor = modelConfig?.provider ?? params.provider;
    const rates: RateEntry[] = modelConfig
      ? [
          ...rateEntriesFromModelConfig(modelConfig, { resource }),
          ...hostedToolRateEntries(modelConfig),
        ]
      : [];

    const extraction = extractProviderBillableUsage(
      vendor,
      {
        usage,
        raw: params.rawUsage ?? usage,
        parts: params.parts,
        structuredData: params.structuredData,
        serviceTier: params.tier,
      },
      {
        hasRate: (unit) => rates.some((rate) => rate.unit === unit),
        longContextThresholdTokens: modelConfig?.longContextPricing?.inputTokenThreshold,
      },
    );

    if (extraction.units.length === 0) {
      return "skipped";
    }

    const [byok, attribution] = await Promise.all([
      userId === undefined ? Promise.resolve(false) : isByokTurn(repositories, userId, vendor),
      resolveUsageAttribution(repositories, params.conversationId),
    ]);

    const occurredAt = params.occurredAt ?? new Date().toISOString();
    const eventScope = params.messageId ?? params.completionId;

    const shared = {
      actor,
      vendor,
      occurredAt,
      byok,
      conversationId: params.conversationId ?? null,
      messageId: params.messageId ?? null,
      completionId: params.completionId,
      projectId: attribution.projectId,
      workspaceId: attribution.workspaceId,
      runId: params.runId ?? null,
      runAttempt: params.runAttempt ?? null,
      rates,
      raw: params.rawUsage ?? usage,
      ...(extraction.tier ? { tier: extraction.tier } : {}),
    };

    const drafts: UsageEventDraft[] = extraction.units.map((unit) => {
      const unitResource = unit.resource ?? resource;

      return Object.assign({}, shared, {
        idempotencyKey: `${unit.source}:${eventScope}:${unitResource}:${unit.unit}`,
        source: unit.source,
        resource: unitResource,
        unit: unit.unit,
        quantity: unit.quantity,
      });
    });

    return await emitUsageEvents({ env, repositories, drafts });
  } catch (error) {
    logger.error("Failed to record model turn usage", {
      error,
      model: params.model,
      provider: params.provider,
      completionId: params.completionId,
    });

    return "failed";
  }
}
