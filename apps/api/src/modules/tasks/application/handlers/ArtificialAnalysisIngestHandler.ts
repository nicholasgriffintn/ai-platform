import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";

import { ingestArtificialAnalysisModels } from "~/modules/model-analysis/application/workflow";
import type { IEnv } from "~/types";

import type { TaskHandler, TaskMessage, TaskResult } from "../types";

const logger = getLogger({ prefix: "services/tasks/artificial-analysis-ingest" });

export class ArtificialAnalysisIngestHandler implements TaskHandler {
  public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    try {
      const result = await ingestArtificialAnalysisModels({
        env,
        sourceTaskId: message.taskId,
      });

      return {
        status: "success",
        message: `Stored ${result.storedModels} Artificial Analysis models`,
        data: result,
      };
    } catch (error) {
      logger.error("Artificial Analysis ingest failed", { error });

      return {
        status: "error",
        message: error instanceof Error ? error.message : "Artificial Analysis ingest failed",
      };
    }
  }
}
