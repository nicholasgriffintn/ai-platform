import {
  gradeToolUse,
  resolveToolUseCaseVerdict,
} from "@ngriffin_uk/polychat-library-model-registry/tool-use";
import {
  TOOL_USE_EVAL_METRIC,
  type EvalCase,
  type EvalCaseResult,
  type ToolUseEvalSample,
  type ToolUseEvalSpec,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import type { ModelRouteRecord } from "~/modules/model-registry/infrastructure/ModelRouteRepository";
import type { IEnv, IUser } from "~/types";

import { MAX_OUTPUT_CHARS } from "../run-results";
import { sampleToolUseCase, type ToolUseSampleRun } from "./sampler";

const SAMPLES_PER_CASE = 2;

export function gradeToolUseSample(
  spec: ToolUseEvalSpec,
  sample: ToolUseSampleRun,
): ToolUseEvalSample {
  const grade = gradeToolUse(spec.expect, sample.trajectory);

  return { ...sample, passed: grade.passed, failures: grade.failures };
}

export function toToolUseCaseResult(
  item: EvalCase,
  samples: readonly ToolUseEvalSample[],
  latencyMs: number,
): EvalCaseResult {
  const { passed } = resolveToolUseCaseVerdict(samples.map((sample) => sample.passed));

  return {
    caseId: item.id,
    output: (samples.at(-1)?.trajectory.finalText ?? "").slice(0, MAX_OUTPUT_CHARS),
    latencyMs,
    scores: { [TOOL_USE_EVAL_METRIC]: passed ? 1 : 0 },
    toolUse: { passed, samples: [...samples] },
  };
}

export function requireToolUseRoute(route: Pick<ModelRouteRecord, "deployment_id">): void {
  if (route.deployment_id) {
    throw new AssistantError(
      "Tool-use suites run on provider routes. This route serves a deployment, which cannot call tools.",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }
}

export async function runToolUseCase(params: {
  env: IEnv;
  user: IUser | undefined;
  route: ModelRouteRecord;
  item: EvalCase;
}): Promise<EvalCaseResult> {
  const { env, user, route, item } = params;
  const spec = item.toolUse;

  requireToolUseRoute(route);

  if (!spec) {
    throw new AssistantError("This case has no tool-use expectation", ErrorType.PARAMS_ERROR, 400);
  }

  if (!user) {
    throw new AssistantError(
      "Tool-use runs need the person who started them",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const context = createServiceContext({ env, user });
  const testCase = { id: item.id, prompt: item.input, spec };
  const target = { model: route.provider_model_id, provider: route.provider };
  const samples: ToolUseEvalSample[] = [];
  const takeSample = async () => {
    samples.push(gradeToolUseSample(spec, await sampleToolUseCase({ context, testCase, target })));
  };

  for (let index = 0; index < SAMPLES_PER_CASE; index += 1) {
    await takeSample();
  }

  if (resolveToolUseCaseVerdict(samples.map((sample) => sample.passed)).needsTieBreak) {
    await takeSample();
  }

  const latencyMs =
    samples.reduce((total, sample) => total + sample.durationMs, 0) / samples.length;

  return toToolUseCaseResult(item, samples, latencyMs);
}
