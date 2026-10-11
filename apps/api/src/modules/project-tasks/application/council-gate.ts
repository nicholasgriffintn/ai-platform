import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { CouncilReviewVerdict } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { reviewOutput } from "~/modules/outputs/application/review";

import { councilShipsStage, type StageCouncilOutcome } from "./completions";

const logger = getLogger({ prefix: "project-tasks/council-gate" });

const MAX_REVIEWED_OUTPUTS = 3;

export async function reviewStageOutputs(
  context: ServiceContext,
  params: {
    taskId: string;
    conversationId: string;
    outputIds: readonly string[];
    runId?: string;
    runAttempt?: number;
  },
): Promise<StageCouncilOutcome> {
  const verdicts: CouncilReviewVerdict[] = [];
  const reviewIds: string[] = [];

  for (const outputId of params.outputIds.slice(0, MAX_REVIEWED_OUTPUTS)) {
    try {
      const review = await reviewOutput(context, outputId, {
        completionId: params.conversationId,
        usageScopeId: `project-task:${params.taskId}:review:${outputId}`,
        runId: params.runId,
        runAttempt: params.runAttempt,
      });

      verdicts.push(review.verdict);
      reviewIds.push(review.id);
    } catch (error) {
      logger.warn("Council review of a stage output failed; holding for a person", {
        taskId: params.taskId,
        outputId,
        error: getErrorMessage(error, "Council review failed"),
      });
      verdicts.push("hold");
    }
  }

  const shipped = params.outputIds.length <= MAX_REVIEWED_OUTPUTS && councilShipsStage(verdicts);

  return { shipped, reviewIds };
}
