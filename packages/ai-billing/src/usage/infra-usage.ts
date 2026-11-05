import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  CLOUDFLARE_RATE_ENTRIES,
  CLOUDFLARE_VENDOR,
  type UsageUnit,
} from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";

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
  runId?: string | null;
  runAttempt?: number | null;
  projectId?: string | null;
  workspaceId?: string | null;
  poolWorkspaceId?: string | null;
  raw?: unknown;
}

export type QueuedInfraUsage = Pick<
  InfraUsageParams,
  "userId" | "scopeKey" | "occurredAt" | "quantities"
>;

interface InfraUsageGroup {
  userId: number;
  occurredAt?: string;
  scopeKeys: string[];
  totals: Map<UsageUnit, number>;
}

export async function aggregateInfraUsage(
  entries: readonly QueuedInfraUsage[],
): Promise<QueuedInfraUsage[]> {
  const unique = new Map(entries.map((entry) => [entry.scopeKey, entry]));
  const groups = new Map<string, InfraUsageGroup>();

  for (const entry of unique.values()) {
    const key = `${entry.userId}:${entry.occurredAt?.slice(0, 10) ?? ""}`;
    const group = groups.get(key) ?? {
      userId: entry.userId,
      occurredAt: entry.occurredAt,
      scopeKeys: [],
      totals: new Map<UsageUnit, number>(),
    };

    group.scopeKeys.push(entry.scopeKey);

    if (entry.occurredAt && (!group.occurredAt || entry.occurredAt < group.occurredAt)) {
      group.occurredAt = entry.occurredAt;
    }

    for (const { unit, quantity } of entry.quantities) {
      if (Number.isFinite(quantity) && quantity > 0) {
        group.totals.set(unit, (group.totals.get(unit) ?? 0) + quantity);
      }
    }

    groups.set(key, group);
  }

  return Promise.all(
    Array.from(groups.values(), async (group) => {
      const scopeKey = [...group.scopeKeys].sort().join("\n");

      return {
        userId: group.userId,
        scopeKey: group.scopeKeys.length === 1 ? scopeKey : `batch-${await sha256Hex(scopeKey)}`,
        occurredAt: group.occurredAt,
        quantities: Array.from(group.totals, ([unit, quantity]) => ({ unit, quantity })),
      };
    }),
  );
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
      runId: params.runId ?? null,
      runAttempt: params.runAttempt ?? null,
      projectId: params.projectId ?? null,
      workspaceId: params.workspaceId ?? null,
      poolWorkspaceId: params.poolWorkspaceId ?? null,
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
