import type { TelemetryEvent } from "@ngriffin_uk/polychat-ai-telemetry";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import { EXPERIMENT_EVENT_CATEGORY, type ExperimentsTelemetry } from "./experiments.js";

export interface OfflineVariant<TConfig> {
  id: string;
  config: TConfig;
}

export interface VariantRunContext {
  experimentKey: string;
  variantId: string;
  runId: string;
  signal?: AbortSignal;
}

export interface VariantRun<TResult> {
  variantId: string;
  runId: string;
  ok: boolean;
  result?: TResult;
  error?: string;
  score?: number;
  durationMs: number;
}

export interface OfflineExperimentOptions<TConfig, TResult> {
  key: string;
  variants: readonly OfflineVariant<TConfig>[];
  execute: (config: TConfig, context: VariantRunContext) => Promise<TResult>;
  metric?: (result: TResult, config: TConfig) => number | Promise<number>;
  higherIsBetter?: boolean;
  concurrency?: number;
  stopOnError?: boolean;
  signal?: AbortSignal;
  telemetry?: ExperimentsTelemetry;
  distinctId?: string;
  now?: () => number;
  onVariantComplete?: (run: VariantRun<TResult>) => void;
}

export interface OfflineExperimentSummary<TResult> {
  key: string;
  runs: VariantRun<TResult>[];
  best?: { variantId: string; score: number };
  successCount: number;
  failureCount: number;
  durationMs: number;
}

function pickBest<TResult>(
  runs: readonly VariantRun<TResult>[],
  higherIsBetter: boolean,
): OfflineExperimentSummary<TResult>["best"] {
  let best: { variantId: string; score: number } | undefined;

  for (const run of runs) {
    if (!run.ok || run.score === undefined || !Number.isFinite(run.score)) {
      continue;
    }

    if (!best || (higherIsBetter ? run.score > best.score : run.score < best.score)) {
      best = { variantId: run.variantId, score: run.score };
    }
  }

  return best;
}

async function runPool<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<boolean>,
): Promise<void> {
  let next = 0;
  let stopped = false;

  const lane = async () => {
    while (!stopped && next < items.length) {
      const item = items[next];

      next += 1;

      if (item !== undefined && !(await worker(item))) {
        stopped = true;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, lane));
}

export async function runExperiment<TConfig, TResult>(
  options: OfflineExperimentOptions<TConfig, TResult>,
): Promise<OfflineExperimentSummary<TResult>> {
  const now = options.now ?? Date.now;
  const higherIsBetter = options.higherIsBetter ?? true;
  const distinctId = options.distinctId ?? "anonymous:server";
  const startedAt = now();
  const runs: VariantRun<TResult>[] = [];
  const capture = (event: Omit<TelemetryEvent, "distinctId" | "category">) =>
    options.telemetry?.capture({ ...event, category: EXPERIMENT_EVENT_CATEGORY, distinctId });

  await runPool(
    options.variants,
    options.concurrency ?? options.variants.length,
    async (variant) => {
      if (options.signal?.aborted) {
        return false;
      }

      const runId = generateId();
      const variantStartedAt = now();
      let run: VariantRun<TResult>;

      try {
        const result = await options.execute(variant.config, {
          experimentKey: options.key,
          variantId: variant.id,
          runId,
          signal: options.signal,
        });
        const score = options.metric ? await options.metric(result, variant.config) : undefined;

        run = {
          variantId: variant.id,
          runId,
          ok: true,
          result,
          score,
          durationMs: now() - variantStartedAt,
        };
      } catch (error) {
        run = {
          variantId: variant.id,
          runId,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          durationMs: now() - variantStartedAt,
        };
      }

      runs.push(run);
      options.onVariantComplete?.(run);
      capture({
        name: "experiment.variant",
        label: options.key,
        value: run.score,
        nonInteraction: true,
        properties: {
          "experiment.key": options.key,
          "experiment.variant": run.variantId,
          "experiment.run_id": run.runId,
          "experiment.ok": run.ok,
          "experiment.duration_ms": run.durationMs,
          ...(run.error ? { "error.message": run.error } : {}),
        },
      });

      return run.ok || !options.stopOnError;
    },
  );

  const summary: OfflineExperimentSummary<TResult> = {
    key: options.key,
    runs,
    best: pickBest(runs, higherIsBetter),
    successCount: runs.filter((run) => run.ok).length,
    failureCount: runs.filter((run) => !run.ok).length,
    durationMs: now() - startedAt,
  };

  capture({
    name: "experiment.completed",
    label: options.key,
    value: summary.best?.score,
    nonInteraction: true,
    properties: {
      "experiment.key": options.key,
      "experiment.variant_count": options.variants.length,
      "experiment.success_count": summary.successCount,
      "experiment.failure_count": summary.failureCount,
      "experiment.best_variant": summary.best?.variantId ?? null,
      "experiment.duration_ms": summary.durationMs,
    },
  });

  return summary;
}

export type ParameterGrid = Record<string, readonly unknown[]>;

export type GridPoint<T extends ParameterGrid> = { [K in keyof T]: T[K][number] };

export function cartesian<T extends ParameterGrid>(grid: T): GridPoint<T>[] {
  const entries = Object.entries(grid);

  if (entries.some(([, values]) => values.length === 0)) {
    return [];
  }

  let points: Record<string, unknown>[] = [{}];

  for (const [key, values] of entries) {
    points = points.flatMap((point) => values.map((value) => ({ ...point, [key]: value })));
  }

  return points as GridPoint<T>[];
}

export function cartesianCount(grid: ParameterGrid): number {
  return Object.values(grid).reduce((count, values) => count * values.length, 1);
}

export function gridVariants<T extends ParameterGrid>(grid: T): OfflineVariant<GridPoint<T>>[] {
  return cartesian(grid).map((config) => ({
    id: Object.entries(config)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(","),
    config,
  }));
}
