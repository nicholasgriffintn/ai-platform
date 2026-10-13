import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { getBenchmark, type Benchmark } from "@ngriffin_uk/polychat-library-benchmarks";
import {
  buildJudgePrompt,
  parseJudgeScore,
  summariseScores,
} from "@ngriffin_uk/polychat-library-model-registry";
import {
  BENCHMARK_RUN_TASK_TYPE,
  benchmarkIdSchema,
  formatBenchmarkScore,
  type BenchmarkItemResult,
  type BenchmarkRunTaskData,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage, percentile, truncateText } from "@ngriffin_uk/polychat-utility-core";

import { ai } from "~/infrastructure/ai";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { getAuxiliaryModel } from "~/modules/models/application/resolve";
import { TaskService } from "~/modules/tasks/application/TaskService";
import { UsageManager } from "~/modules/usage/application/usageManager";
import type { IEnv, IUser } from "~/types";

import { BenchmarkResultStore } from "../infrastructure/BenchmarkResultStore";
import type { BenchmarkRunRecord } from "../infrastructure/BenchmarkRunRepository";
import { resolveEntrantTarget, type EntrantTarget } from "./entrants";
import { invokeEntrant } from "./invoke";

const logger = getLogger({ prefix: "modules/benchmarks/runner" });

const ITEMS_PER_TASK = 5;
const MAX_STORED_OUTPUT = 20_000;
const RUN_TASK_PRIORITY = 7;

export async function enqueueBenchmarkRunTask(
  env: IEnv,
  repositories: RepositoryManager,
  runId: string,
  offset: number,
): Promise<void> {
  await new TaskService(env, repositories.tasks).enqueueTask({
    id: `${BENCHMARK_RUN_TASK_TYPE}:${runId}:${offset}`,
    task_type: BENCHMARK_RUN_TASK_TYPE,
    task_data: { runId, offset },
    priority: RUN_TASK_PRIORITY,
  });
}

async function judgeArtefact(
  env: IEnv,
  benchmark: Benchmark,
  itemId: string,
  content: string,
): Promise<number | null> {
  if (!benchmark.judgeRubric) {
    return null;
  }

  const judge = await getAuxiliaryModel(env);
  const verdict = await ai.complete({
    env,
    model: judge.model,
    provider: judge.provider,
    reasoning_effort: judge.effort,
    prompt: buildJudgePrompt({
      rubric: benchmark.judgeRubric,
      input: benchmark.prompt(itemId).user,
      output: content,
    }),
  });

  return parseJudgeScore(verdict.text);
}

async function runItem(
  env: IEnv,
  repositories: RepositoryManager,
  run: BenchmarkRunRecord,
  benchmark: Benchmark,
  target: EntrantTarget,
  user: IUser | null,
  itemId: string,
): Promise<BenchmarkItemResult> {
  const started = Date.now();

  try {
    const response = await invokeEntrant(
      {
        env,
        repositories,
        user,
        runId: run.id,
        benchmarkId: benchmarkIdSchema.parse(run.benchmark_id),
        benchmark,
        itemId,
      },
      target,
    );
    const scored = benchmark.score(itemId, response.answer);
    const artefact = benchmark.artefact(itemId, response.answer);
    const judged =
      artefact && benchmark.summary.scoring === "votes"
        ? await judgeArtefact(env, benchmark, itemId, artefact.content)
        : null;

    return {
      itemId,
      score: judged ?? scored.score,
      answer: response.answer,
      output: truncateText(response.output, MAX_STORED_OUTPUT),
      artefact,
      detail: judged === null ? scored.detail : { ...scored.detail, judge: judged },
      error: null,
      latencyMs: response.latencyMs,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      costUsd: response.costUsd,
    };
  } catch (error) {
    return {
      itemId,
      score: 0,
      answer: null,
      output: "",
      artefact: null,
      detail: { failed: true },
      error: truncateText(getErrorMessage(error, "The entrant did not answer"), 500),
      latencyMs: Date.now() - started,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: null,
    };
  }
}

function totals(results: readonly BenchmarkItemResult[]) {
  const costs = results.flatMap((result) => (result.costUsd === null ? [] : [result.costUsd]));

  return {
    input_tokens: results.reduce((total, result) => total + result.inputTokens, 0),
    output_tokens: results.reduce((total, result) => total + result.outputTokens, 0),
    cost_usd: costs.length > 0 ? costs.reduce((total, cost) => total + cost, 0) : null,
    latency_p50_ms: percentile(
      results.filter((result) => !result.error).map((result) => result.latencyMs),
      0.5,
    ),
  };
}

export function summariseRunResults(benchmark: Benchmark, results: readonly BenchmarkItemResult[]) {
  return {
    score: summariseScores(
      results.flatMap((result) => (result.score === null ? [] : [result.score])),
    ),
    metrics: benchmark.metrics(
      results.map((result) => ({
        itemId: result.itemId,
        answer: result.answer,
        score: result.score,
        detail: result.detail,
      })),
    ),
  };
}

async function recordWorkspaceEvidence(
  repositories: RepositoryManager,
  run: BenchmarkRunRecord,
  benchmark: Benchmark,
  mean: number,
): Promise<void> {
  if (run.entrant.kind !== "route") {
    return;
  }

  await repositories.modelGovernance.addEvidence([
    {
      versionId: run.entrant.versionId,
      routeId: run.entrant.routeId,
      kind: "eval",
      source: "polychat_benchmark",
      status: "pass",
      summary: `${benchmark.summary.name}: ${formatBenchmarkScore(benchmark.summary, mean)}`,
      details: { benchmarkId: benchmark.summary.id, version: run.version, runId: run.id },
    },
  ]);
}

async function failRun(
  repositories: RepositoryManager,
  runId: string,
  reason: string,
): Promise<{ status: "error"; message: string }> {
  await repositories.benchmarkRuns.update(runId, { status: "failed", failure_reason: reason });

  return { status: "error", message: reason };
}

async function isOutOfCredit(repositories: RepositoryManager, user: IUser): Promise<boolean> {
  const limits = await new UsageManager(repositories, user, null).getUsageLimits();

  return limits.credits.state === "exhausted";
}

export async function executeBenchmarkRun(
  env: IEnv,
  repositories: RepositoryManager,
  data: BenchmarkRunTaskData,
) {
  const run = await repositories.benchmarkRuns.get(data.runId);

  if (!run || (run.status !== "queued" && run.status !== "running")) {
    return { status: "success" as const, message: `Benchmark run ${data.runId} needs no work` };
  }

  const benchmark = getBenchmark(benchmarkIdSchema.parse(run.benchmark_id));

  if (benchmark.summary.version !== run.version) {
    return failRun(repositories, run.id, "The benchmark changed version before this run finished");
  }

  try {
    await repositories.benchmarkRuns.claim(run.id);

    const user = run.owner_user_id ? await repositories.users.getUserById(run.owner_user_id) : null;

    if (run.scope !== "official" && !user) {
      return failRun(repositories, run.id, "The person who started this run is gone");
    }

    const target = await resolveEntrantTarget(env, repositories, user, run.entrant);

    if (
      user &&
      target.kind !== "route" &&
      target.model.credentialAuthority === "platform" &&
      (await isOutOfCredit(repositories, user))
    ) {
      return failRun(repositories, run.id, "Usage limit reached before the run finished");
    }

    const store = BenchmarkResultStore.forEnv(env);
    const previous = data.offset > 0 ? await store.readResults(run.id) : [];
    const batch = benchmark.itemIds.slice(data.offset, data.offset + ITEMS_PER_TASK);
    const fresh = await Promise.all(
      batch.map((itemId) => runItem(env, repositories, run, benchmark, target, user, itemId)),
    );
    const results = [...previous, ...fresh];
    const nextOffset = data.offset + batch.length;

    await store.writeResults(run.id, results);
    await repositories.benchmarkRuns.update(run.id, {
      items_completed: results.length,
      ...totals(results),
    });

    if (nextOffset < benchmark.itemIds.length) {
      await enqueueBenchmarkRunTask(env, repositories, run.id, nextOffset);

      return {
        status: "success" as const,
        message: `${nextOffset}/${benchmark.itemIds.length} items`,
      };
    }

    if (results.every((result) => result.error !== null)) {
      return failRun(repositories, run.id, results[0]?.error ?? "Every item failed");
    }

    const summary = summariseRunResults(benchmark, results);

    await repositories.benchmarkRuns.update(run.id, {
      status: "completed",
      score: summary.score,
      metrics: summary.metrics,
      completed_at: new Date().toISOString(),
    });
    await recordWorkspaceEvidence(repositories, run, benchmark, summary.score.mean);

    return { status: "success" as const, message: `Completed ${results.length} items` };
  } catch (error) {
    const reason = getErrorMessage(error, "Unknown error");

    logger.error("Benchmark run failed", { runId: run.id, error: reason });

    return failRun(repositories, run.id, reason);
  }
}
