import { getModels } from "@ngriffin_uk/polychat-ai-models";
import { getBenchmark, listBenchmarks } from "@ngriffin_uk/polychat-library-benchmarks";
import {
  MODEL_TIER_LINEUP,
  benchmarkEntrantKey,
  findModelByReference,
  isActiveModel,
  type BenchmarkRun,
  type QueueOfficialBenchmarkRunsRequest,
} from "@ngriffin_uk/polychat-schemas";

import { BENCHMARKS_CONFIG } from "~/config/benchmarks";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import type { IEnv } from "~/types";

import {
  findOfficialModel,
  isDecisionModel,
  isOfficialProvider,
  modelEntrant,
  modelIneligibility,
} from "./entrants";
import { toBenchmarkRun } from "./mappers";
import { enqueueBenchmarkRunTask } from "./runner";

export interface OfficialQueueResult {
  queued: BenchmarkRun[];
  skippedForBudget: boolean;
  spentThisMonthUsd: number;
}

function startOfMonth(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function officialCandidateModelIds(env: IEnv): string[] {
  const models = getModels();
  const lineup = Object.values(MODEL_TIER_LINEUP.hosted).flatMap((roles) =>
    Object.values(roles).flatMap((candidates) => [...candidates]),
  );
  const fromLineup = lineup.flatMap((candidate) => {
    if (!isOfficialProvider(candidate.provider)) {
      return [];
    }

    const resolved = findModelByReference(models, candidate);

    return resolved ? [resolved.id] : [];
  });
  const decisionModels = Object.entries(models)
    .filter(([, config]) => isActiveModel(config) && isDecisionModel(config))
    .map(([id]) => id);

  return [...new Set([...fromLineup, ...decisionModels])].filter((id) =>
    Boolean(findOfficialModel(env, id)),
  );
}

export async function queueOfficialRuns(
  env: IEnv,
  repositories: RepositoryManager,
  request: QueueOfficialBenchmarkRunsRequest = {},
  now = new Date(),
): Promise<OfficialQueueResult> {
  const spentThisMonthUsd = await repositories.benchmarkRuns.officialSpendSince(startOfMonth(now));

  if (spentThisMonthUsd >= BENCHMARKS_CONFIG.officialMonthlyBudgetUsd) {
    return { queued: [], skippedForBudget: true, spentThisMonthUsd };
  }

  const benchmarks = request.benchmarkIds?.length
    ? request.benchmarkIds.map(getBenchmark)
    : listBenchmarks();
  const modelIds = request.modelIds?.length ? request.modelIds : officialCandidateModelIds(env);
  const queued: BenchmarkRun[] = [];

  for (const benchmark of benchmarks) {
    const existing = await repositories.benchmarkRuns.listOfficialEntrantKeys(
      benchmark.summary.id,
      benchmark.summary.version,
      { retryFailed: Boolean(request.modelIds?.length) },
    );

    for (const modelId of modelIds) {
      if (queued.length >= BENCHMARKS_CONFIG.officialRunsPerQueuePass) {
        return { queued, skippedForBudget: false, spentThisMonthUsd };
      }

      const config = findOfficialModel(env, modelId);

      if (!config || modelIneligibility(benchmark, config)) {
        continue;
      }

      const entrant = modelEntrant(modelId, config);

      if (existing.has(benchmarkEntrantKey(entrant))) {
        continue;
      }

      const record = await repositories.benchmarkRuns.create({
        benchmarkId: benchmark.summary.id,
        version: benchmark.summary.version,
        scope: "official",
        entrant,
        ownerUserId: null,
        workspaceId: null,
        status: "queued",
        visibility: "public",
        itemsTotal: benchmark.summary.itemCount,
      });

      await enqueueBenchmarkRunTask(env, repositories, record.id, 0);
      queued.push(toBenchmarkRun(record));
    }
  }

  return { queued, skippedForBudget: false, spentThisMonthUsd };
}
