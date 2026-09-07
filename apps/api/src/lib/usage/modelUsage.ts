import {
  hostedToolRateEntries,
  modelRateResource,
  rateEntriesFromModelConfig,
  type RunProvenance,
  type RateEntry,
} from "@ngriffin_uk/polychat-schemas";

import { getModelConfig } from "~/lib/providers/models";
import { RepositoryManager } from "~/repositories";
import type { IEnv, MessagePart } from "~/types";
import { getLogger } from "~/utils/logger";

import { offPlatformUsageMarker } from "./billableUnits";
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
  provenance?: RunProvenance | null;
}

export interface RecordOffPlatformRunUsageParams {
  env: IEnv;
  repositories?: RepositoryManager;
  actor?: CreditActor | null;
  provenance: RunProvenance;
  provider?: string;
  completionId: string;
  messageId?: string | null;
  conversationId?: string | null;
  runId?: string | null;
  runAttempt?: number | null;
  occurredAt?: string;
}

export async function recordOffPlatformRunUsage(
  params: RecordOffPlatformRunUsageParams,
): Promise<UsageEmissionOutcome> {
  const { env, actor } = params;

  if (!actor || !env?.DB) {
    return "skipped";
  }

  try {
    const repositories = params.repositories ?? new RepositoryManager(env);
    const attribution = await resolveUsageAttribution(repositories, params.conversationId);
    const marker = offPlatformUsageMarker(params.provenance.site);
    const eventScope = params.messageId ?? params.completionId;
    const vendor = params.provenance.vendor ?? params.provider ?? "off-platform";
    const raw = {
      ...marker,
      machineId: params.provenance.machineId ?? null,
      model: params.provenance.model,
    };

    return await emitUsageEvents({
      env,
      repositories,
      drafts: [
        {
          idempotencyKey: `model:off_platform:${eventScope}`,
          actor,
          source: "model",
          vendor,
          resource: params.provenance.model,
          unit: "requests",
          quantity: 1,
          vendorUnits: marker.vendorUnits,
          reason: marker.reason,
          site: marker.site,
          occurredAt: params.occurredAt,
          conversationId: params.conversationId ?? null,
          messageId: params.messageId ?? null,
          completionId: params.completionId,
          runId: params.runId ?? null,
          runAttempt: params.runAttempt ?? null,
          raw,
          projectId: attribution.projectId,
          workspaceId: attribution.workspaceId,
        },
      ],
    });
  } catch (error) {
    logger.error("Failed to record an off-platform model run", {
      error,
      completionId: params.completionId,
      model: params.provenance.model,
      site: params.provenance.site,
    });

    return "failed";
  }
}

export async function recordModelTurnUsage(
  params: RecordModelTurnUsageParams,
): Promise<UsageEmissionOutcome> {
  const { env, usage, actor } = params;

  if (params.provenance && params.provenance.site !== "hosted") {
    return recordOffPlatformRunUsage({
      env,
      repositories: params.repositories,
      actor,
      provenance: params.provenance,
      provider: params.provider,
      completionId: params.completionId,
      messageId: params.messageId,
      conversationId: params.conversationId,
      runId: params.runId,
      runAttempt: params.runAttempt,
      occurredAt: params.occurredAt,
    });
  }

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
