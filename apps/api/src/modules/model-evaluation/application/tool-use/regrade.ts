import { findToolUseRegressions } from "@ngriffin_uk/polychat-library-model-registry/tool-use";
import {
  TOOL_USE_EVAL_METRIC,
  type EvalCaseResult,
  type RegradeEvalRunRequest,
  type RegradeEvalRunResponse,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ModelEvalRepository } from "~/modules/model-evaluation/infrastructure/ModelEvalRepository";
import type { ModelEvalSuiteRecord } from "~/modules/model-evaluation/infrastructure/ModelEvalRepository";
import {
  badRequest,
  notFound,
  requireModelAction,
} from "~/modules/model-registry/application/access";
import { ModelRouteRepository } from "~/modules/model-registry/infrastructure/ModelRouteRepository";

import { toEvalRun } from "../mappers";
import { readEvalResults, summariseMetrics, writeEvalResults } from "../run-results";
import { gradeToolUseSample, toToolUseCaseResult } from "./case-runner";

function regradeResults(
  suite: Pick<ModelEvalSuiteRecord, "cases">,
  results: readonly EvalCaseResult[],
): EvalCaseResult[] {
  const cases = new Map(suite.cases.map((item) => [item.id, item]));

  return results.map((result) => {
    const item = cases.get(result.caseId);
    const spec = item?.toolUse;

    if (!item || !spec || !result.toolUse) {
      return result;
    }

    return {
      ...toToolUseCaseResult(
        item,
        result.toolUse.samples.map((sample) => gradeToolUseSample(spec, sample)),
        result.latencyMs,
      ),
      ...(result.error ? { error: result.error } : {}),
    };
  });
}

function toolUseVerdicts(results: readonly EvalCaseResult[]): Map<string, boolean> {
  return new Map(
    results.flatMap((result) => (result.toolUse ? [[result.caseId, result.toolUse.passed]] : [])),
  );
}

async function loadCompletedRun(context: ServiceContext, workspaceId: string, runId: string) {
  const repository = context.repositories.get(ModelEvalRepository);
  const run = await repository.getRun(runId);
  const route = run
    ? await context.repositories.get(ModelRouteRepository).getRoute(workspaceId, run.route_id)
    : null;

  if (!run || !route) {
    throw notFound("Eval run");
  }

  if (run.status !== "completed") {
    throw badRequest("Only completed runs can be regraded");
  }

  return run;
}

export async function regradeEvalRun(
  context: ServiceContext,
  workspaceId: string,
  runId: string,
  input: RegradeEvalRunRequest,
): Promise<RegradeEvalRunResponse> {
  await requireModelAction(context, workspaceId, "deploy");

  const repository = context.repositories.get(ModelEvalRepository);
  const bucket = context.env.PRIVATE_ASSETS_BUCKET;
  const run = await loadCompletedRun(context, workspaceId, runId);
  const suite = await repository.getSuite(workspaceId, run.suite_id);

  if (!suite) {
    throw notFound("Eval suite");
  }

  if (suite.suite_kind !== "tool_use") {
    throw badRequest("Only tool-use runs keep what they need to be regraded");
  }

  if (!bucket) {
    throw badRequest("No private storage bucket is configured");
  }

  const results = regradeResults(suite, await readEvalResults(bucket, run.id));

  await writeEvalResults(bucket, run.id, results);
  await repository.updateRunScores(
    run.id,
    summariseMetrics([TOOL_USE_EVAL_METRIC], results),
    run.latency_p95_ms,
  );

  let regressions: string[] | null = null;

  if (input.baselineRunId) {
    const baseline = await loadCompletedRun(context, workspaceId, input.baselineRunId);

    if (baseline.suite_id !== suite.id) {
      throw badRequest("Compare runs of the same suite");
    }

    regressions = findToolUseRegressions(
      toolUseVerdicts(results),
      toolUseVerdicts(regradeResults(suite, await readEvalResults(bucket, baseline.id))),
    );
  }

  const updated = await repository.getRun(run.id);

  if (!updated) {
    throw notFound("Eval run");
  }

  return { run: toEvalRun(updated), regressions };
}
