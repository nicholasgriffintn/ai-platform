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
  isActiveBenchmarkRunStatus,
  type BenchmarkItemResult,
  type BenchmarkRunTaskData,
} from "@ngriffin_uk/polychat-schemas";
import {
  createConcurrencyLimiter,
  getErrorMessage,
  percentile,
  sleep,
  truncateText,
} from "@ngriffin_uk/polychat-utility-core";
import {
  classifyProviderRetryError,
  getProviderRetryAfterMs,
} from "@ngriffin_uk/polychat-utility-server/provider-errors";

import { BENCHMARKS_CONFIG } from "~/config/benchmarks";
import { ai } from "~/infrastructure/ai";
import type { Repositories } from "~/infrastructure/database/repositories";
import { BenchmarkRunRepository } from "~/modules/benchmarks/infrastructure/BenchmarkRunRepository";
import { ModelGovernanceRepository } from "~/modules/model-registry/infrastructure/ModelGovernanceRepository";
import { getAuxiliaryModel } from "~/modules/models/application/resolve";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { UsageManager } from "~/modules/usage/application/usageManager";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import type { IEnv, IUser } from "~/types";

import { BenchmarkResultStore } from "../infrastructure/BenchmarkResultStore";
import type { BenchmarkRunRecord } from "../infrastructure/BenchmarkRunRepository";
import {
  isFatalEntrantError,
  officialRunRefusal,
  resolveEntrantTarget,
  type EntrantTarget,
} from "./entrants";
import { invokeEntrant } from "./invoke";

const logger = getLogger({ prefix: "modules/benchmarks/runner" });

const TASK_TIME_BUDGET_MS = 4 * 60 * 1000;
const TRANSIENT_ATTEMPTS = 3;
const MAX_ITEM_ATTEMPTS = 2;
const TRANSIENT_DELAY_MS = 3_000;
const MAX_RETRY_DELAY_MS = 60_000;
const RETRY_HINT_PATTERN = /retry in ([\d.]+)\s*s/i;
const MAX_STORED_OUTPUT = 20_000;
const MAX_STORED_ERROR = 500;
const RUN_TASK_PRIORITY = 7;
const PASSES = ["first", "sweep"] as const;

type RunOutcome =
  | { kind: "done" }
  | { kind: "cancelled" }
  | { kind: "out_of_time"; resolved: number }
  | { kind: "fatal"; reason: string };

export type BenchmarkTaskKind = "start" | "retry" | "continue" | "sweep";

export function benchmarkTaskPrefix(runId: string): string {
  return `${BENCHMARK_RUN_TASK_TYPE}:${runId}:`;
}

export function maxPassesFor(itemsTotal: number): number {
  return Math.max(BENCHMARKS_CONFIG.maxTasksPerRun, itemsTotal * 2 + 2);
}

export async function enqueueBenchmarkRunTask(
  env: IEnv,
  repositories: Repositories,
  runId: string,
  options: { kind: BenchmarkTaskKind; retryChecks?: boolean; itemsTotal?: number },
): Promise<boolean> {
  if (options.kind === "continue" || options.kind === "sweep") {
    const passes = await repositories
      .get(TaskRepository)
      .countTasksByIdPrefix(benchmarkTaskPrefix(runId));

    if (passes >= maxPassesFor(options.itemsTotal ?? 0)) {
      await repositories.get(BenchmarkRunRepository).update(runId, {
        status: "failed",
        failure_reason: `Gave up after ${passes} worker passes without finishing`,
      });

      return false;
    }
  }

  const data: BenchmarkRunTaskData = options.retryChecks ? { runId, retryChecks: true } : { runId };

  await new TaskService(env, repositories.get(TaskRepository)).enqueueTask({
    id: `${benchmarkTaskPrefix(runId)}${Date.now()}`,
    task_type: BENCHMARK_RUN_TASK_TYPE,
    task_data: data,
    priority: RUN_TASK_PRIORITY,
  });

  return true;
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

  try {
    const judge = await getAuxiliaryModel(env);
    const verdict = await ai.complete({
      env,
      model: judge.model,
      provider: judge.provider,
      reasoning_effort: judge.effort,
      disable_functions: true,
      prompt: buildJudgePrompt({
        rubric: benchmark.judgeRubric,
        input: benchmark.prompt(itemId).user,
        output: content,
      }),
    });

    return parseJudgeScore(verdict.text);
  } catch (error) {
    logger.warn("Benchmark judge failed, keeping the gate score", {
      benchmarkId: benchmark.summary.id,
      itemId,
      error: getErrorMessage(error, "Unknown error"),
    });

    return null;
  }
}

function hintedRetryMs(error: unknown): number | undefined {
  const fromContext = getProviderRetryAfterMs(error);

  if (fromContext !== undefined) {
    return fromContext;
  }

  const match = RETRY_HINT_PATTERN.exec(getErrorMessage(error, ""));

  return match ? Number(match[1]) * 1000 : undefined;
}

export function benchmarkRetryDelayMs(error: unknown, attempt: number): number {
  const hinted = hintedRetryMs(error);

  return Math.min(MAX_RETRY_DELAY_MS, Math.round(hinted ?? TRANSIENT_DELAY_MS * attempt) + 1_000);
}

async function invokeWithRetries(
  scope: Parameters<typeof invokeEntrant>[0],
  target: EntrantTarget,
  deadline: number,
) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await invokeEntrant(scope, target);
    } catch (error) {
      const classification = classifyProviderRetryError(error);
      const delayMs = benchmarkRetryDelayMs(error, attempt);

      if (
        attempt >= TRANSIENT_ATTEMPTS ||
        !classification.retryable ||
        classification.classification === "timeout" ||
        Date.now() + delayMs >= deadline
      ) {
        throw error;
      }

      logger.warn("Benchmark item hit a transient provider error, retrying", {
        runId: scope.runId,
        itemId: scope.itemId,
        attempt,
        delayMs,
        error: getErrorMessage(error, "Unknown error"),
      });
      await sleep(delayMs);
    }
  }
}

export interface RunContext {
  env: IEnv;
  repositories: Repositories;
  run: BenchmarkRunRecord;
  benchmark: Benchmark;
  target: EntrantTarget;
  user: IUser | null;
  billingUser: IUser | null;
  deadline: number;
}

function errorResult(
  itemId: string,
  error: unknown,
  latencyMs: number,
  attempts: number,
): BenchmarkItemResult {
  return {
    itemId,
    score: null,
    answer: null,
    output: "",
    artefact: null,
    detail: { failed: true },
    error: truncateText(getErrorMessage(error, "The entrant did not answer"), MAX_STORED_ERROR),
    attempts,
    latencyMs,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: null,
  };
}

async function runItem(
  context: RunContext,
  itemId: string,
  attempts: number,
): Promise<{ result: BenchmarkItemResult; cause: unknown }> {
  const { env, repositories, run, benchmark, target, user, billingUser } = context;
  const started = Date.now();

  try {
    const response = await invokeWithRetries(
      {
        env,
        repositories,
        user,
        billingUser,
        runId: run.id,
        benchmarkId: benchmarkIdSchema.parse(run.benchmark_id),
        benchmark,
        itemId,
      },
      target,
      context.deadline,
    );
    const scored = benchmark.score(itemId, response.answer);
    const artefact = benchmark.artefact(itemId, response.answer);
    const judged =
      artefact && benchmark.summary.scoring === "votes"
        ? await judgeArtefact(env, benchmark, itemId, artefact.content)
        : null;

    return {
      result: {
        itemId,
        score: judged ?? scored.score,
        answer: response.answer,
        output: truncateText(response.output, MAX_STORED_OUTPUT),
        artefact,
        detail: {
          ...scored.detail,
          ...(judged === null ? {} : { judge: judged }),
          ...(response.blocked === null ? {} : { blocked: response.blocked }),
        },
        error: null,
        attempts,
        latencyMs: response.latencyMs,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        costUsd: response.costUsd,
      },
      cause: null,
    };
  } catch (error) {
    return { result: errorResult(itemId, error, Date.now() - started, attempts), cause: error };
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

export function rescoreAutoResults(
  benchmark: Benchmark,
  results: readonly BenchmarkItemResult[],
): BenchmarkItemResult[] {
  if (benchmark.summary.scoring !== "auto") {
    return [...results];
  }

  return results.map((result) => {
    if (result.error !== null || result.answer === null) {
      return result;
    }

    const scored = benchmark.score(result.itemId, result.answer);

    return { ...result, score: scored.score, detail: scored.detail };
  });
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

export function describeUnanswered(
  results: readonly BenchmarkItemResult[],
  itemsTotal: number,
): string | null {
  const unanswered = results.filter((result) => result.error !== null);
  const missing = itemsTotal - results.length;
  const count = unanswered.length + missing;

  if (count === 0) {
    return null;
  }

  const first = unanswered[0]?.error ?? "The run stopped before every item was tried";

  return `${count} of ${itemsTotal} items got no answer. ${first}`;
}

export class RunProgress {
  private readonly results = new Map<string, BenchmarkItemResult>();
  private flush: Promise<void> = Promise.resolve();
  private cancelled = false;

  constructor(
    private readonly store: BenchmarkResultStore,
    private readonly repositories: Repositories,
    private readonly runId: string,
    private readonly itemIds: readonly string[],
    stored: readonly BenchmarkItemResult[],
  ) {
    for (const result of stored) {
      this.results.set(result.itemId, result);
    }
  }

  pendingItemIds(options: { pass: "first" | "sweep"; includeFailedChecks: boolean }): string[] {
    return this.itemIds.filter((itemId) => {
      const result = this.results.get(itemId);

      if (!result) {
        return options.pass === "first";
      }

      if (result.error !== null) {
        return options.pass === "sweep" && this.attemptsFor(itemId) < MAX_ITEM_ATTEMPTS;
      }

      return (
        options.pass === "first" &&
        options.includeFailedChecks &&
        result.artefact === null &&
        result.score === 0 &&
        this.attemptsFor(itemId) < MAX_ITEM_ATTEMPTS
      );
    });
  }

  attemptsFor(itemId: string): number {
    return this.results.get(itemId)?.attempts ?? (this.results.has(itemId) ? 1 : 0);
  }

  answeredCount(): number {
    return this.ordered().filter((result) => result.error === null).length;
  }

  ordered(): BenchmarkItemResult[] {
    return this.itemIds.flatMap((itemId) => {
      const result = this.results.get(itemId);

      return result ? [result] : [];
    });
  }

  isCancelled(): boolean {
    return this.cancelled;
  }

  record(result: BenchmarkItemResult): void {
    this.results.set(result.itemId, result);
  }

  checkpoint(): Promise<void> {
    this.flush = this.flush.then(() => this.write());

    return this.flush;
  }

  private async write(): Promise<void> {
    const results = this.ordered();

    await this.store.writeResults(this.runId, results);
    await this.repositories.get(BenchmarkRunRepository).update(this.runId, {
      items_completed: this.answeredCount(),
      ...totals(results),
    });

    this.cancelled =
      (await this.repositories.get(BenchmarkRunRepository).getStatus(this.runId)) === "cancelled";
  }
}

export async function answerItems(
  context: RunContext,
  progress: RunProgress,
  startedAt: number,
  options: { retryChecks: boolean },
): Promise<RunOutcome> {
  const limiter = createConcurrencyLimiter(BENCHMARKS_CONFIG.itemConcurrency);

  for (const pass of PASSES) {
    const pending = progress.pendingItemIds({
      pass,
      includeFailedChecks: options.retryChecks && context.benchmark.summary.scoring === "votes",
    });

    if (pending.length === 0) {
      continue;
    }

    const halt: { outcome: RunOutcome | null } = { outcome: null };
    let resolved = 0;

    logger.info("Benchmark pass starting", { runId: context.run.id, pass, items: pending.length });

    await Promise.all(
      pending.map((itemId) =>
        limiter(async () => {
          if (halt.outcome) {
            return;
          }

          if (Date.now() - startedAt >= TASK_TIME_BUDGET_MS) {
            halt.outcome ??= { kind: "out_of_time", resolved: 0 };

            return;
          }

          const { result, cause } = await runItem(
            context,
            itemId,
            progress.attemptsFor(itemId) + 1,
          );

          progress.record(result);
          resolved += 1;

          if (result.error !== null && isFatalEntrantError(cause)) {
            halt.outcome ??= { kind: "fatal", reason: result.error };
          }

          await progress.checkpoint();

          if (progress.isCancelled()) {
            halt.outcome ??= { kind: "cancelled" };
          }
        }),
      ),
    );

    await progress.checkpoint();

    if (progress.isCancelled()) {
      return { kind: "cancelled" };
    }

    if (halt.outcome) {
      return halt.outcome.kind === "out_of_time" ? { kind: "out_of_time", resolved } : halt.outcome;
    }
  }

  return { kind: "done" };
}

async function recordWorkspaceEvidence(
  repositories: Repositories,
  run: BenchmarkRunRecord,
  benchmark: Benchmark,
  mean: number,
): Promise<void> {
  if (run.entrant.kind !== "route") {
    return;
  }

  await repositories.get(ModelGovernanceRepository).addEvidence([
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
  repositories: Repositories,
  runId: string,
  reason: string,
): Promise<{ status: "success"; message: string }> {
  await repositories
    .get(BenchmarkRunRepository)
    .update(runId, { status: "failed", failure_reason: reason });

  return { status: "success", message: `Benchmark run ${runId} failed: ${reason}` };
}

async function isOutOfCredit(repositories: Repositories, user: IUser): Promise<boolean> {
  const limits = await new UsageManager(repositories, user, null).getUsageLimits();

  return limits.credits.state === "exhausted";
}

export async function executeBenchmarkRun(
  env: IEnv,
  repositories: Repositories,
  data: BenchmarkRunTaskData,
) {
  const run = await repositories.get(BenchmarkRunRepository).get(data.runId);

  if (!run || !isActiveBenchmarkRunStatus(run.status)) {
    return { status: "success" as const, message: `Benchmark run ${data.runId} needs no work` };
  }

  const benchmark = getBenchmark(benchmarkIdSchema.parse(run.benchmark_id));

  if (benchmark.summary.version !== run.version) {
    return failRun(repositories, run.id, "The benchmark changed version before this run finished");
  }

  const refusal = officialRunRefusal(run);

  if (refusal) {
    await repositories.get(BenchmarkRunRepository).update(run.id, {
      status: "cancelled",
      failure_reason: refusal,
    });

    return { status: "success" as const, message: `Benchmark run ${run.id} cancelled: ${refusal}` };
  }

  if (
    !(await repositories
      .get(BenchmarkRunRepository)
      .claim(run.id, BENCHMARKS_CONFIG.staleRunMinutes))
  ) {
    return {
      status: "success" as const,
      message: `Benchmark run ${run.id} is already held by another worker`,
    };
  }

  try {
    const user = run.owner_user_id
      ? await repositories.get(UserRepository).getUserById(run.owner_user_id)
      : null;

    if (run.scope !== "official" && !user) {
      return failRun(repositories, run.id, "The person who started this run is gone");
    }

    const target = await resolveEntrantTarget(env, repositories, user, run.entrant, run.scope);
    const billingUser = run.scope === "official" ? null : user;

    if (
      billingUser &&
      target.kind !== "route" &&
      target.model.credentialAuthority === "platform" &&
      (await isOutOfCredit(repositories, billingUser))
    ) {
      return failRun(repositories, run.id, "Usage limit reached before the run finished");
    }

    const store = BenchmarkResultStore.forEnv(env);
    const progress = new RunProgress(
      store,
      repositories,
      run.id,
      benchmark.itemIds,
      await store.readResults(run.id),
    );
    const startedAt = Date.now();
    const outcome = await answerItems(
      {
        env,
        repositories,
        run,
        benchmark,
        target,
        user,
        billingUser,
        deadline: startedAt + TASK_TIME_BUDGET_MS,
      },
      progress,
      startedAt,
      { retryChecks: data.retryChecks === true },
    );

    if (outcome.kind === "cancelled") {
      return { status: "success" as const, message: `Benchmark run ${run.id} was cancelled` };
    }

    if (outcome.kind === "out_of_time" && outcome.resolved === 0) {
      return failRun(repositories, run.id, "A worker pass finished without resolving any item");
    }

    if (outcome.kind === "out_of_time") {
      await repositories.get(BenchmarkRunRepository).release(run.id);

      const continued = await enqueueBenchmarkRunTask(env, repositories, run.id, {
        kind: "continue",
        retryChecks: data.retryChecks === true,
        itemsTotal: benchmark.itemIds.length,
      });

      return {
        status: "success" as const,
        message: continued
          ? `${progress.answeredCount()}/${benchmark.itemIds.length} items answered so far`
          : `Benchmark run ${run.id} gave up after too many passes`,
      };
    }

    if (outcome.kind === "fatal") {
      return failRun(repositories, run.id, outcome.reason);
    }

    const unanswered = describeUnanswered(progress.ordered(), benchmark.itemIds.length);

    if (unanswered) {
      return failRun(repositories, run.id, unanswered);
    }

    const results = rescoreAutoResults(benchmark, progress.ordered());
    const summary = summariseRunResults(benchmark, results);

    await store.writeResults(run.id, results);
    await repositories.get(BenchmarkRunRepository).update(run.id, {
      status: "completed",
      items_total: benchmark.itemIds.length,
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
