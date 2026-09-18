import { getLogger, type NormalisedTokenUsage } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  hostedToolRateEntries,
  modelRateResource,
  rateEntriesFromModelConfig,
  type MessagePart,
  type RateEntry,
  type RunProvenance,
} from "@ngriffin_uk/polychat-schemas";

import { offPlatformUsageMarker } from "../billable-units.js";
import { extractProviderBillableUsage } from "../provider-billable-units.js";
import { creditActorUserId, type CreditActor } from "./credit-actor.js";
import {
  emitUsageEvents,
  resolveUsageAttribution,
  type UsageEmissionOutcome,
  type UsageEventDraft,
} from "./ledger.js";
import type { UsageRuntime, UsageStore } from "./store.js";

const logger = getLogger({ prefix: "ai-billing/model-usage" });

export async function isByokTurn(
  store: UsageStore,
  userId: number,
  provider: string,
): Promise<boolean> {
  try {
    return await store.hasProviderApiKey(userId, provider);
  } catch (error) {
    logger.warn("Failed to resolve BYOK state for a usage event", { error, userId, provider });

    return false;
  }
}

export interface RecordModelTurnUsageParams {
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
  runtime: UsageRuntime,
  params: RecordOffPlatformRunUsageParams,
): Promise<UsageEmissionOutcome> {
  const { actor } = params;

  if (!actor) {
    return "skipped";
  }

  try {
    const attribution = await resolveUsageAttribution(runtime.store, params.conversationId);
    const marker = offPlatformUsageMarker(params.provenance.site);
    const eventScope = params.messageId ?? params.completionId;
    const vendor = params.provenance.vendor ?? params.provider ?? "off-platform";
    const raw = {
      ...marker,
      machineId: params.provenance.machineId ?? null,
      model: params.provenance.model,
    };

    return await emitUsageEvents(runtime, {
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
  runtime: UsageRuntime,
  params: RecordModelTurnUsageParams,
): Promise<UsageEmissionOutcome> {
  const { usage, actor } = params;

  if (params.provenance && params.provenance.site !== "hosted") {
    return recordOffPlatformRunUsage(runtime, {
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

  if (!actor || (!usage && params.rawUsage === undefined)) {
    return "skipped";
  }

  const userId = creditActorUserId(actor);

  try {
    const modelConfig = await runtime.resolveModelConfig?.(params.model, params.provider, userId);
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
      userId === undefined ? Promise.resolve(false) : isByokTurn(runtime.store, userId, vendor),
      resolveUsageAttribution(runtime.store, params.conversationId),
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

      return {
        ...shared,
        idempotencyKey: `${unit.source}:${eventScope}:${unitResource}:${unit.unit}`,
        source: unit.source,
        resource: unitResource,
        unit: unit.unit,
        quantity: unit.quantity,
      };
    });

    return await emitUsageEvents(runtime, { drafts });
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
