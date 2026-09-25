import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  buildJudgePrompt,
  isMeaningfullyLower,
  parseJudgeScore,
  scoreDeterministic,
  summariseScores,
} from "@ngriffin_uk/polychat-library-model-registry";
import {
  evalCaseResultSchema,
  MODEL_REGISTRY_EVAL_TASK_TYPE,
  type EvalCase,
  type EvalCaseResult,
  type ScoreSummary,
} from "@ngriffin_uk/polychat-schemas";
import {
  getErrorMessage,
  percentile,
  sampleDeterministic,
} from "@ngriffin_uk/polychat-utility-core";

import { ai } from "~/infrastructure/ai";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { findModelConfig, getAuxiliaryModel } from "~/modules/models/application/resolve";
import { TaskService } from "~/modules/tasks/application/TaskService";
import type { IEnv } from "~/types";

import type {
  ModelEvalRunRecord,
  ModelEvalSuiteRecord,
} from "../infrastructure/ModelEvalRepository";
import type { AddEvidenceInput } from "../infrastructure/ModelGovernanceRepository";
import type { ModelRouteRecord } from "../infrastructure/ModelRouteRepository";
import { openRouteReview, syncVersionReviews } from "./decisions";
import { refreshEndpoint } from "./endpoints";

const logger = getLogger({ prefix: "modules/model-registry/eval-runner" });

const CASES_PER_TASK = 20;
const DEPLOYMENT_READINESS_ATTEMPTS = 18;
const DEPLOYMENT_READINESS_DELAY_MS = 10 * 60 * 1000;
const MAX_OUTPUT_CHARS = 20_000;

function resultsKey(runId: string): string {
  return `model-registry/eval-runs/${runId}.json`;
}

function casesForRun(
  suite: Pick<ModelEvalSuiteRecord, "cases" | "replay_sample_size">,
  run: Pick<ModelEvalRunRecord, "id" | "trigger">,
): EvalCase[] {
  return run.trigger === "replay"
    ? sampleDeterministic(suite.cases, suite.replay_sample_size, run.id)
    : suite.cases;
}

export async function readEvalResults(
  bucket: R2Bucket | undefined,
  runId: string,
): Promise<EvalCaseResult[]> {
  const object = await bucket?.get(resultsKey(runId));

  return object ? evalCaseResultSchema.array().parse(await object.json()) : [];
}

async function runCase(
  env: IEnv,
  suite: ModelEvalSuiteRecord,
  route: ModelRouteRecord,
  item: EvalCase,
  judge: { model: string; provider: string },
): Promise<EvalCaseResult> {
  const started = Date.now();

  try {
    const completion = await ai.complete({
      env,
      model: route.provider_model_id,
      provider: route.provider,
      system: suite.system_prompt ?? undefined,
      prompt: item.input,
    });
    const output = completion.text.slice(0, MAX_OUTPUT_CHARS);
    const latencyMs = Date.now() - started;
    const scores: Record<string, number> = {};

    for (const scorer of suite.scorers) {
      if (scorer.type !== "judge") {
        scores[scorer.metric] = scoreDeterministic(scorer, output, item.expected);
        continue;
      }

      const verdict = await ai.complete({
        env,
        model: judge.model,
        provider: judge.provider,
        prompt: buildJudgePrompt({
          rubric: scorer.rubric,
          input: item.input,
          output,
          expected: item.expected,
        }),
      });
      const score = parseJudgeScore(verdict.text);

      if (score !== null) {
        scores[scorer.metric] = score;
      }
    }

    return { caseId: item.id, output, latencyMs, scores };
  } catch (error) {
    return {
      caseId: item.id,
      output: "",
      latencyMs: Date.now() - started,
      scores: Object.fromEntries(
        suite.scorers
          .filter((scorer) => scorer.type !== "judge")
          .map((scorer) => [scorer.metric, 0]),
      ),
      error: getErrorMessage(error, "Unknown error"),
    };
  }
}

function summarise(suite: ModelEvalSuiteRecord, results: readonly EvalCaseResult[]) {
  const scores: Record<string, ScoreSummary> = {};

  for (const scorer of suite.scorers) {
    scores[scorer.metric] = summariseScores(
      results.flatMap((result) =>
        result.scores[scorer.metric] === undefined ? [] : [result.scores[scorer.metric]],
      ),
    );
  }

  const latencies = results.filter((result) => !result.error).map((result) => result.latencyMs);

  return { scores, latencyP95Ms: percentile(latencies, 0.95) };
}

async function recordRunEvidence(
  repositories: RepositoryManager,
  suite: ModelEvalSuiteRecord,
  run: ModelEvalRunRecord,
  route: ModelRouteRecord,
  scores: Record<string, ScoreSummary>,
  errors: number,
): Promise<void> {
  const primaryMetric = suite.scorers[0]?.metric;
  const primary = primaryMetric ? scores[primaryMetric] : undefined;
  const evidence: AddEvidenceInput[] = [
    {
      versionId: run.version_id,
      routeId: route.id,
      kind: "eval",
      source: run.trigger === "replay" ? "replay" : "polychat_eval",
      status: errors > run.cases_total / 10 ? "warn" : "pass",
      summary: primary
        ? `${suite.name}: ${primaryMetric} ${(primary.mean * 100).toFixed(1)}% (${(primary.low * 100).toFixed(1)}–${(primary.high * 100).toFixed(1)}, n=${primary.n})`
        : `${suite.name}: no scores`,
      details: { suiteId: suite.id, runId: run.id, trigger: run.trigger, scores, errors },
    },
  ];

  if (run.trigger === "replay" && primaryMetric && primary) {
    const baseline = (
      await repositories.modelEvals.listRuns({
        suiteIds: [suite.id],
        routeIds: [route.id],
        limit: 50,
      })
    ).find(
      (candidate) =>
        candidate.status === "completed" &&
        candidate.trigger !== "replay" &&
        candidate.scores[primaryMetric] !== undefined,
    );

    if (baseline) {
      const baselineScore = baseline.scores[primaryMetric];
      const drifted = isMeaningfullyLower(primary, baselineScore);

      evidence.push({
        versionId: run.version_id,
        routeId: route.id,
        kind: "drift",
        source: "replay",
        status: drifted ? "fail" : "pass",
        summary: drifted
          ? `${primaryMetric} fell from ${(baselineScore.mean * 100).toFixed(1)}% to ${(primary.mean * 100).toFixed(1)}%`
          : `${primaryMetric} holds at ${(primary.mean * 100).toFixed(1)}% against a ${(baselineScore.mean * 100).toFixed(1)}% baseline`,
        details: {
          suiteId: suite.id,
          runId: run.id,
          baselineRunId: baseline.id,
          metric: primaryMetric,
        },
      });
    }
  }

  await repositories.modelGovernance.addEvidence(evidence);

  const drift = evidence.find((item) => item.kind === "drift" && item.status === "fail");

  if (drift) {
    await openRouteReview(repositories, route, drift.summary);
  }
}

async function waitForDeployment(
  env: IEnv,
  repositories: RepositoryManager,
  run: ModelEvalRunRecord,
  route: ModelRouteRecord,
  readinessAttempt: number,
): Promise<"ready" | "waiting" | "timed_out"> {
  if (!route.deployment_ref) {
    return "ready";
  }

  await refreshEndpoint(env, repositories, route);

  const config = await findModelConfig(
    route.provider_model_id,
    env,
    route.provider,
    run.created_by ?? undefined,
  );

  if (config) {
    return "ready";
  }

  if (readinessAttempt >= DEPLOYMENT_READINESS_ATTEMPTS) {
    return "timed_out";
  }

  await new TaskService(env, repositories.tasks).enqueueTask({
    id: `${MODEL_REGISTRY_EVAL_TASK_TYPE}:${run.id}:wait:${readinessAttempt + 1}`,
    task_type: MODEL_REGISTRY_EVAL_TASK_TYPE,
    task_data: { runId: run.id, offset: 0, readinessAttempt: readinessAttempt + 1 },
    schedule_type: "scheduled",
    scheduled_at: new Date(Date.now() + DEPLOYMENT_READINESS_DELAY_MS).toISOString(),
    priority: 6,
  });

  return "waiting";
}

export async function executeEvalRun(
  env: IEnv,
  repositories: RepositoryManager,
  data: { runId: string; offset: number; readinessAttempt: number },
) {
  const run = await repositories.modelEvals.getRun(data.runId);
  const suite = run ? await repositories.modelEvals.getSuiteById(run.suite_id) : null;
  const route = run ? await repositories.modelRoutes.getRouteById(run.route_id) : null;
  const bucket: R2Bucket | undefined = env.PRIVATE_ASSETS_BUCKET;

  if (!run || !suite || !route) {
    return { status: "skipped" as const, message: `Eval run ${data.runId} is gone` };
  }

  if (!bucket) {
    await repositories.modelEvals.updateRun(run.id, {
      status: "failed",
      failure_reason: "No private storage bucket is configured",
    });

    return { status: "error" as const, message: "No private storage bucket is configured" };
  }

  try {
    const readiness = await waitForDeployment(env, repositories, run, route, data.readinessAttempt);

    if (readiness === "waiting") {
      return { status: "success" as const, message: "Waiting for the deployment to come up" };
    }

    if (readiness === "timed_out") {
      await repositories.modelEvals.updateRun(run.id, {
        status: "failed",
        failure_reason: "The deployment never became ready",
      });

      return { status: "error" as const, message: "The deployment never became ready" };
    }

    await repositories.modelEvals.updateRun(run.id, { status: "running" });

    const cases = casesForRun(suite, run);
    const judge = await getAuxiliaryModel(env);
    const previous = data.offset > 0 ? await readEvalResults(bucket, run.id) : [];
    const batch = cases.slice(data.offset, data.offset + CASES_PER_TASK);
    const fresh: EvalCaseResult[] = [];

    for (const item of batch) {
      fresh.push(await runCase(env, suite, route, item, judge));
    }

    const results = [...previous, ...fresh];
    const nextOffset = data.offset + batch.length;

    await bucket.put(resultsKey(run.id), JSON.stringify(results), {
      httpMetadata: { contentType: "application/json" },
    });
    await repositories.modelEvals.updateRun(run.id, { cases_completed: results.length });

    if (nextOffset < cases.length) {
      await new TaskService(env, repositories.tasks).enqueueTask({
        id: `${MODEL_REGISTRY_EVAL_TASK_TYPE}:${run.id}:${nextOffset}`,
        task_type: MODEL_REGISTRY_EVAL_TASK_TYPE,
        task_data: { runId: run.id, offset: nextOffset, readinessAttempt: 0 },
        priority: 6,
      });

      return { status: "success" as const, message: `${nextOffset}/${cases.length} cases` };
    }

    const { scores, latencyP95Ms } = summarise(suite, results);
    const errors = results.filter((result) => result.error).length;

    await repositories.modelEvals.updateRunScores(run.id, scores, latencyP95Ms);
    await recordRunEvidence(repositories, suite, run, route, scores, errors);
    await syncVersionReviews(repositories, route.workspace_id, run.version_id);

    return { status: "success" as const, message: `Completed ${results.length} cases` };
  } catch (error) {
    const reason = getErrorMessage(error, "Unknown error");

    logger.error("Eval run failed", { runId: run.id, error: reason });
    await repositories.modelEvals.updateRun(run.id, { status: "failed", failure_reason: reason });

    return { status: "error" as const, message: reason };
  }
}
