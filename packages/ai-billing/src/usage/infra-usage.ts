import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  CLOUDFLARE_RATE_ENTRIES,
  CLOUDFLARE_VENDOR,
  type UsageUnit,
} from "@ngriffin_uk/polychat-schemas";

import { userCreditActor } from "./credit-actor.js";
import { emitUsageEvents, type UsageEmissionDelivery, type UsageEventDraft } from "./ledger.js";
import type { UsageRuntime } from "./store.js";

const logger = getLogger({ prefix: "ai-billing/infra-usage" });

const INFRA_UNIT_RESOURCES: Partial<Record<UsageUnit, string>> = {
  d1_rows_read: "d1",
  d1_rows_written: "d1",
  do_requests: "durable_objects",
  do_gb_seconds: "durable_objects",
  do_rows_read: "durable_objects",
  do_rows_written: "durable_objects",
  vectorize_queried_dimensions: "vectorize",
  vectorize_stored_dimensions: "vectorize",
  queue_operations: "queues",
  container_vcpu_seconds: "containers",
  container_gib_seconds: "containers",
  container_disk_gb_seconds: "containers",
  container_egress_gb: "containers",
  worker_requests: "workers",
  worker_cpu_ms: "workers",
  ai_neurons: "workers_ai",
  analytics_data_points: "analytics_engine",
  r2_class_a_ops: "r2",
  r2_class_b_ops: "r2",
};

export interface InfraUsageQuantity {
  unit: UsageUnit;
  quantity: number;
}

export interface InfraUsageParams {
  userId: number;
  scopeKey: string;
  quantities: readonly InfraUsageQuantity[];
  occurredAt?: string;
  conversationId?: string | null;
  activityId?: string | null;
  raw?: unknown;
}

export function buildInfraUsageDrafts(params: InfraUsageParams): UsageEventDraft[] {
  return params.quantities
    .filter((entry) => Number.isFinite(entry.quantity) && entry.quantity > 0)
    .map((entry) => ({
      idempotencyKey: `infra:${params.scopeKey}:${entry.unit}`,
      actor: userCreditActor(params.userId),
      source: "infrastructure" as const,
      vendor: CLOUDFLARE_VENDOR,
      resource: INFRA_UNIT_RESOURCES[entry.unit] ?? "workers",
      unit: entry.unit,
      quantity: entry.quantity,
      occurredAt: params.occurredAt,
      conversationId: params.conversationId ?? null,
      activityId: params.activityId ?? null,
      rates: CLOUDFLARE_RATE_ENTRIES,
      raw: params.raw,
    }));
}

export async function emitInfraUsage(
  runtime: UsageRuntime,
  params: InfraUsageParams & { delivery?: UsageEmissionDelivery },
): Promise<void> {
  const drafts = buildInfraUsageDrafts(params);

  if (drafts.length === 0) {
    return;
  }

  try {
    await emitUsageEvents(runtime, { drafts, delivery: params.delivery });
  } catch (error) {
    logger.error("Failed to emit infrastructure usage", { error, scopeKey: params.scopeKey });
  }
}
