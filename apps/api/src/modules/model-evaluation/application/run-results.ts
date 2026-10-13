import { isMeaningfullyLower, summariseScores } from "@ngriffin_uk/polychat-library-model-registry";
import {
  evalCaseResultSchema,
  type EvalCase,
  type EvalCaseResult,
  type ReasoningEffort,
  type ScoreSummary,
} from "@ngriffin_uk/polychat-schemas";
import { percentile, sampleDeterministic } from "@ngriffin_uk/polychat-utility-core";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import {
  openRouteReview,
  syncVersionReviews,
} from "~/modules/model-registry/application/decisions";
import type { AddEvidenceInput } from "~/modules/model-registry/infrastructure/ModelGovernanceRepository";
import type { ModelRouteRecord } from "~/modules/model-registry/infrastructure/ModelRouteRepository";
import type { IEnv } from "~/types";

import type {
  ModelEvalRunRecord,
  ModelEvalSuiteRecord,
} from "../infrastructure/ModelEvalRepository";
import type { ModelGraderRecord } from "../infrastructure/ModelGraderRepository";
import { scoreWithGrader } from "./graders";

export const MAX_OUTPUT_CHARS = 20_000;

export interface EvalJudge {
  model: string;
  provider: string;
  effort?: ReasoningEffort;
}

function resultsKey(runId: string): string {
  return `model-registry/eval-runs/${runId}.json`;
}

export function casesForRun(
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

export async function writeEvalResults(
  bucket: R2Bucket,
  runId: string,
  results: readonly EvalCaseResult[],
): Promise<void> {
  await bucket.put(resultsKey(runId), JSON.stringify(results), {
    httpMetadata: { contentType: "application/json" },
  });
}

export function failedCaseResult(
  graders: readonly ModelGraderRecord[],
  item: EvalCase,
  error: string,
  latencyMs: number,
): EvalCaseResult {
  return {
    caseId: item.id,
    output: "",
    latencyMs,
    scores: Object.fromEntries(
      graders
        .filter((grader) => grader.config.kind !== "judge")
        .map((grader) => [grader.metric, 0]),
    ),
    error,
  };
}

export async function gradeCaseOutput(
  env: IEnv,
  repositories: RepositoryManager,
  suite: ModelEvalSuiteRecord,
  graders: readonly ModelGraderRecord[],
  item: EvalCase,
  completion: string,
  latencyMs: number,
  judge: EvalJudge,
): Promise<EvalCaseResult> {
  const output = completion.slice(0, MAX_OUTPUT_CHARS);
  const scores: Record<string, number> = {};

  for (const grader of graders) {
    const score = await scoreWithGrader(
      { env, repositories, workspaceId: suite.workspace_id, projectId: suite.project_id },
      grader.config,
      { input: item.input, output, expected: item.expected },
      judge,
    );

    if (score !== null) {
      scores[grader.metric] = score;
    }
  }

  return { caseId: item.id, output, latencyMs, scores };
}

function summarise(
  graders: readonly ModelGraderRecord[],
  results: readonly EvalCaseResult[],
  measureLatency: boolean,
) {
  const scores: Record<string, ScoreSummary> = {};

  for (const grader of graders) {
    scores[grader.metric] = summariseScores(
      results.flatMap((result) =>
        result.scores[grader.metric] === undefined ? [] : [result.scores[grader.metric]],
      ),
    );
  }

  const latencies = results.filter((result) => !result.error).map((result) => result.latencyMs);

  return { scores, latencyP95Ms: measureLatency ? percentile(latencies, 0.95) : null };
}

async function recordRunEvidence(
  repositories: RepositoryManager,
  suite: ModelEvalSuiteRecord,
  graders: readonly ModelGraderRecord[],
  run: ModelEvalRunRecord,
  route: ModelRouteRecord,
  scores: Record<string, ScoreSummary>,
  errors: number,
): Promise<void> {
  const primaryMetric = graders[0]?.metric;
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

export async function completeEvalRun(
  repositories: RepositoryManager,
  input: {
    suite: ModelEvalSuiteRecord;
    graders: readonly ModelGraderRecord[];
    run: ModelEvalRunRecord;
    route: ModelRouteRecord;
    results: readonly EvalCaseResult[];
    measureLatency: boolean;
  },
): Promise<void> {
  const { suite, graders, run, route, results, measureLatency } = input;
  const { scores, latencyP95Ms } = summarise(graders, results, measureLatency);
  const errors = results.filter((result) => result.error).length;

  await repositories.modelEvals.updateRunScores(run.id, scores, latencyP95Ms);
  await recordRunEvidence(repositories, suite, graders, run, route, scores, errors);
  await syncVersionReviews(repositories, route.workspace_id, run.version_id);
}
