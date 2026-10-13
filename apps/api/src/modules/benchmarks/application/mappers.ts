import { benchmarkIdSchema, type BenchmarkRun } from "@ngriffin_uk/polychat-schemas";

import type { BenchmarkRunRecord } from "../infrastructure/BenchmarkRunRepository";

export function toBenchmarkRun(
  record: BenchmarkRunRecord,
  options: { includeShareToken?: boolean } = {},
): BenchmarkRun {
  return {
    id: record.id,
    benchmarkId: benchmarkIdSchema.parse(record.benchmark_id),
    version: record.version,
    entrant: record.entrant,
    scope: record.scope,
    status: record.status,
    visibility: record.visibility,
    itemsTotal: record.items_total,
    itemsCompleted: record.items_completed,
    score: record.score ?? null,
    metrics: record.metrics,
    rating: record.rating ?? null,
    usage: {
      inputTokens: record.input_tokens,
      outputTokens: record.output_tokens,
      costUsd: record.cost_usd ?? null,
      latencyP50Ms: record.latency_p50_ms ?? null,
    },
    shareToken: options.includeShareToken ? (record.share_token ?? null) : null,
    failureReason: record.failure_reason ?? null,
    createdAt: record.created_at,
    completedAt: record.completed_at ?? null,
  };
}
