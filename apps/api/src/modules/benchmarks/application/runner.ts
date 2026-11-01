import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { TaskSteps } from "@ngriffin_uk/polychat-ai-workflows";
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
import { z } from "zod/v4";

import { BENCHMARKS_CONFIG } from "~/config/benchmarks";
import { ai } from "~/infrastructure/ai";
import type { Repositories } from "~/infrastructure/database/repositories";
import { BenchmarkRunRepository } from "~/modules/benchmarks/infrastructure/BenchmarkRunRepository";
import { ModelGovernanceRepository } from "~/modules/model-registry/infrastructure/ModelGovernanceRepository";
import { getAuxiliaryModel } from "~/modules/models/application/resolve";
import { TaskService } from "~/modules/queue/application/TaskService";
import type { TaskResult } from "~/modules/queue/application/types";
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

const TRANSIENT_ATTEMPTS = 3;
const MAX_ITEM_ATTEMPTS = 2;
const TRANSIENT_DELAY_MS = 3_000;
const MAX_RETRY_DELAY_MS = 60_000;
const RETRY_HINT_PATTERN = /retry in ([\d.]+)\s*s/i;
const MAX_STORED_OUTPUT = 20_000;
const MAX_STORED_ERROR = 500;
const RUN_TASK_PRIORITY = 7;
const PASSES = ["first", "sweep"] as const;

const itemStateSchema = z.object({
  itemId: z.string(),
  attempts: z.number().int().nonnegative(),
  errored: z.boolean(),
});

const itemOutcomeSchema = itemStateSchema.extend({
  error: z.string().nullable(),
  fatal: z.boolean(),
  cancelled: z.boolean(),
});

const runPlanSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("stop"), message: z.string() }),
  z.object({
    kind: z.literal("run"),
    first: z.array(z.string()),
    known: z.array(itemStateSchema),
  }),
]);

type ItemState = z.infer<typeof itemStateSchema>;
type ItemOutcome = z.infer<typeof itemOutcomeSchema>;
type RunPlan = z.infer<typeof runPlanSchema>;
type PassOutcome = { kind: "done" } | { kind: "cancelled" } | { kind: "fatal"; reason: string };

export async function enqueueBenchmarkRunTask(
  env: IEnv,
  repositories: Repositories,
  runId: string,
  options: { retryChecks?: boolean } = {},
): Promise<void> {
  const data: BenchmarkRunTaskData = options.retryChecks ? { runId, retryChecks: true } : { runId };

  await new TaskService(env, repositories.get(TaskRepository)).enqueueTask({
    task_type: BENCHMARK_RUN_TASK_TYPE,
    task_data: data,
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
        classification.classification === "timeout"
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
}

type LoadedRun = { kind: "ready"; context: RunContext } | { kind: "refused"; reason: string };

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

function attemptsOf(result: BenchmarkItemResult): number {
  return result.attempts ?? 1;
}

function firstPassItemIds(
  itemIds: readonly string[],
  stored: readonly BenchmarkItemResult[],
  options: { includeFailedChecks: boolean },
): string[] {
  const results = new Map(stored.map((result) => [result.itemId, result]));

  return itemIds.filter((itemId) => {
    const result = results.get(itemId);

    if (!result) {
      return true;
    }

    return (
      options.includeFailedChecks &&
      result.error === null &&
      result.artefact === null &&
      result.score === 0 &&
      attemptsOf(result) < MAX_ITEM_ATTEMPTS
    );
  });
}

class ItemLedger {
  private readonly attempts = new Map<string, number>();
  private readonly errored = new Set<string>();

  constructor(known: readonly ItemState[]) {
    for (const state of known) {
      this.record(state);
    }
  }

  nextAttempt(itemId: string): number {
    return (this.attempts.get(itemId) ?? 0) + 1;
  }

  record(state: ItemState): void {
    this.attempts.set(state.itemId, state.attempts);

    if (state.errored) {
      this.errored.add(state.itemId);
    } else {
      this.errored.delete(state.itemId);
    }
  }

  sweepItemIds(itemIds: readonly string[]): string[] {
    return itemIds.filter(
      (itemId) => this.errored.has(itemId) && (this.attempts.get(itemId) ?? 0) < MAX_ITEM_ATTEMPTS,
    );
  }
}

class RunProgress {
  private flush: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly store: BenchmarkResultStore,
    private readonly repositories: Repositories,
    private readonly runId: string,
    private readonly itemIds: readonly string[],
  ) {}

  record(result: BenchmarkItemResult): Promise<boolean> {
    const write = this.flush.then(() => this.write(result));

    this.flush = write.catch(() => undefined);

    return write;
  }

  private async write(result: BenchmarkItemResult): Promise<boolean> {
    const stored = new Map(
      (await this.store.readResults(this.runId)).map((entry) => [entry.itemId, entry]),
    );

    stored.set(result.itemId, result);

    const results = this.itemIds.flatMap((itemId) => {
      const entry = stored.get(itemId);

      return entry ? [entry] : [];
    });
    const runs = this.repositories.get(BenchmarkRunRepository);

    await this.store.writeResults(this.runId, results);
    await runs.update(this.runId, {
      items_completed: results.filter((entry) => entry.error === null).length,
      ...totals(results),
    });

    return (await runs.getStatus(this.runId)) === "cancelled";
  }
}

async function answerItem(
  context: RunContext,
  progress: RunProgress,
  itemId: string,
  attempts: number,
): Promise<ItemOutcome> {
  const { result, cause } = await runItem(context, itemId, attempts);
  const cancelled = await progress.record(result);

  return {
    itemId,
    attempts,
    errored: result.error !== null,
    error: result.error,
    fatal: result.error !== null && isFatalEntrantError(cause),
    cancelled,
  };
}

async function answerPass(
  context: RunContext,
  progress: RunProgress,
  ledger: ItemLedger,
  steps: TaskSteps,
  pass: (typeof PASSES)[number],
  itemIds: readonly string[],
): Promise<PassOutcome> {
  const limiter = createConcurrencyLimiter(BENCHMARKS_CONFIG.itemConcurrency);
  const halt: { cancelled: boolean; fatal: string | null } = { cancelled: false, fatal: null };

  logger.info("Benchmark pass starting", { runId: context.run.id, pass, items: itemIds.length });

  await Promise.all(
    itemIds.map((itemId) =>
      limiter(async () => {
        if (halt.cancelled || halt.fatal !== null) {
          return;
        }

        const outcome = await steps.value(`item:${pass}:${itemId}`, itemOutcomeSchema, () =>
          answerItem(context, progress, itemId, ledger.nextAttempt(itemId)),
        );

        ledger.record(outcome);
        halt.cancelled ||= outcome.cancelled;

        if (outcome.fatal && outcome.error !== null) {
          halt.fatal ??= outcome.error;
        }
      }),
    ),
  );

  if (halt.cancelled) {
    return { kind: "cancelled" };
  }

  return halt.fatal === null ? { kind: "done" } : { kind: "fatal", reason: halt.fatal };
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

async function failRun(repositories: Repositories, runId: string, reason: string): Promise<string> {
  await repositories
    .get(BenchmarkRunRepository)
    .update(runId, { status: "failed", failure_reason: reason });

  return `Benchmark run ${runId} failed: ${reason}`;
}

export async function failActiveBenchmarkRun(
  repositories: Repositories,
  runId: string,
  reason: string,
): Promise<void> {
  const status = await repositories.get(BenchmarkRunRepository).getStatus(runId);

  if (status && isActiveBenchmarkRunStatus(status)) {
    await failRun(repositories, runId, reason);
  }
}

async function isOutOfCredit(repositories: Repositories, user: IUser): Promise<boolean> {
  const limits = await new UsageManager(repositories, user, null).getUsageLimits();

  return limits.credits.state === "exhausted";
}

async function loadRunContext(
  env: IEnv,
  repositories: Repositories,
  runId: string,
): Promise<LoadedRun> {
  const run = await repositories.get(BenchmarkRunRepository).get(runId);

  if (!run) {
    return { kind: "refused", reason: "The run no longer exists" };
  }

  const user = run.owner_user_id
    ? await repositories.get(UserRepository).getUserById(run.owner_user_id)
    : null;

  if (run.scope !== "official" && !user) {
    return { kind: "refused", reason: "The person who started this run is gone" };
  }

  return {
    kind: "ready",
    context: {
      env,
      repositories,
      run,
      benchmark: getBenchmark(benchmarkIdSchema.parse(run.benchmark_id)),
      target: await resolveEntrantTarget(env, repositories, user, run.entrant, run.scope),
      user,
      billingUser: run.scope === "official" ? null : user,
    },
  };
}

async function claimBenchmarkRun(
  repositories: Repositories,
  runId: string,
): Promise<string | null> {
  const runs = repositories.get(BenchmarkRunRepository);
  const run = await runs.get(runId);

  if (!run || !isActiveBenchmarkRunStatus(run.status)) {
    return `Benchmark run ${runId} needs no work`;
  }

  const benchmark = getBenchmark(benchmarkIdSchema.parse(run.benchmark_id));

  if (benchmark.summary.version !== run.version) {
    return failRun(repositories, run.id, "The benchmark changed version before this run finished");
  }

  const refusal = officialRunRefusal(run);

  if (refusal) {
    await runs.update(run.id, { status: "cancelled", failure_reason: refusal });

    return `Benchmark run ${run.id} cancelled: ${refusal}`;
  }

  return (await runs.claim(run.id))
    ? null
    : `Benchmark run ${run.id} is already held by another worker`;
}

async function planBenchmarkRun(
  env: IEnv,
  repositories: Repositories,
  data: BenchmarkRunTaskData,
): Promise<RunPlan> {
  const loaded = await loadRunContext(env, repositories, data.runId);

  if (loaded.kind === "refused") {
    return { kind: "stop", message: await failRun(repositories, data.runId, loaded.reason) };
  }

  const { run, benchmark, target, billingUser } = loaded.context;

  if (
    billingUser &&
    target.kind !== "route" &&
    target.model.credentialAuthority === "platform" &&
    (await isOutOfCredit(repositories, billingUser))
  ) {
    return {
      kind: "stop",
      message: await failRun(repositories, run.id, "Usage limit reached before the run finished"),
    };
  }

  const stored = await BenchmarkResultStore.forEnv(env).readResults(run.id);

  return {
    kind: "run",
    first: firstPassItemIds(benchmark.itemIds, stored, {
      includeFailedChecks: data.retryChecks === true && benchmark.summary.scoring === "votes",
    }),
    known: stored.map((result) => ({
      itemId: result.itemId,
      attempts: attemptsOf(result),
      errored: result.error !== null,
    })),
  };
}

async function finishBenchmarkRun(context: RunContext): Promise<string> {
  const { env, repositories, run, benchmark } = context;
  const store = BenchmarkResultStore.forEnv(env);
  const stored = new Map((await store.readResults(run.id)).map((entry) => [entry.itemId, entry]));
  const ordered = benchmark.itemIds.flatMap((itemId) => {
    const entry = stored.get(itemId);

    return entry ? [entry] : [];
  });
  const unanswered = describeUnanswered(ordered, benchmark.itemIds.length);

  if (unanswered) {
    return failRun(repositories, run.id, unanswered);
  }

  const results = rescoreAutoResults(benchmark, ordered);
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

  return `Completed ${results.length} items`;
}

export async function executeBenchmarkRun(
  env: IEnv,
  repositories: Repositories,
  data: BenchmarkRunTaskData,
  steps: TaskSteps,
): Promise<TaskResult> {
  const refused = await steps.value("claim", z.string().nullable(), () =>
    claimBenchmarkRun(repositories, data.runId),
  );

  if (refused !== null) {
    return { status: "success", message: refused };
  }

  const plan = await steps.value("plan", runPlanSchema, () =>
    planBenchmarkRun(env, repositories, data),
  );

  if (plan.kind === "stop") {
    return { status: "success", message: plan.message };
  }

  const loaded = await loadRunContext(env, repositories, data.runId);

  if (loaded.kind === "refused") {
    throw new Error(loaded.reason);
  }

  const { context } = loaded;
  const progress = new RunProgress(
    BenchmarkResultStore.forEnv(env),
    repositories,
    data.runId,
    context.benchmark.itemIds,
  );
  const ledger = new ItemLedger(plan.known);

  for (const pass of PASSES) {
    const pending = pass === "first" ? plan.first : ledger.sweepItemIds(context.benchmark.itemIds);

    if (pending.length === 0) {
      continue;
    }

    const outcome = await answerPass(context, progress, ledger, steps, pass, pending);

    if (outcome.kind === "cancelled") {
      return { status: "success", message: `Benchmark run ${data.runId} was cancelled` };
    }

    if (outcome.kind === "fatal") {
      return {
        status: "success",
        message: await steps.value("fail", z.string(), () =>
          failRun(repositories, data.runId, outcome.reason),
        ),
      };
    }
  }

  return {
    status: "success",
    message: await steps.value("finish", z.string(), () => finishBenchmarkRun(context)),
  };
}
