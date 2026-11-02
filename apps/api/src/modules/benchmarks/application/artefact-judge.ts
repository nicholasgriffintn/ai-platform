import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { Benchmark } from "@ngriffin_uk/polychat-library-benchmarks";
import { buildJudgePrompt, parseJudgeScore } from "@ngriffin_uk/polychat-library-model-registry";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";

import { ai } from "~/infrastructure/ai";
import { getAuxiliaryModel } from "~/modules/models/application/resolve";
import type { IEnv, IUser } from "~/types";

const logger = getLogger({ prefix: "modules/benchmarks/artefact-judge" });

export async function judgeBenchmarkArtefact(
  scope: { env: IEnv; user?: IUser; workspaceId?: string | null },
  benchmark: Benchmark,
  itemId: string,
  content: string,
): Promise<number | null> {
  if (!benchmark.judgeRubric) {
    return null;
  }

  try {
    const judge = await getAuxiliaryModel(scope.env, scope.user, {
      workspaceId: scope.workspaceId,
    });
    const verdict = await ai.complete({
      env: scope.env,
      user: scope.user,
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
