import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";

import { scoreArtificialAnalysisModels } from "~/services/model-analysis/workflow";
import type { IEnv } from "~/types";

import type { TaskHandler, TaskMessage, TaskResult } from "../types";

const logger = getLogger({ prefix: "services/tasks/artificial-analysis-scoring" });

export class ArtificialAnalysisScoringHandler implements TaskHandler {
  public async handle(_message: TaskMessage, env: IEnv): Promise<TaskResult> {
    try {
      const result = await scoreArtificialAnalysisModels({
        env,
      });

      return {
        status: "success",
        message: `Scored ${result.scoredModels} Artificial Analysis models`,
        data: result,
      };
    } catch (error) {
      logger.error("Artificial Analysis scoring failed", { error });

      return {
        status: "error",
        message: error instanceof Error ? error.message : "Artificial Analysis scoring failed",
      };
    }
  }
}
