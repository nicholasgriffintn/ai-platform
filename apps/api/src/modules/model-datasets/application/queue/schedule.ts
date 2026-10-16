import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";

import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import type { IEnv } from "~/types";

const logger = getLogger({ prefix: "modules/model-datasets/schedule" });

export async function scheduleTrainingQualityScoring(env: IEnv): Promise<void> {
  try {
    const unscoredCount = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM training_examples
			 WHERE quality_score IS NULL AND include_in_training = 1`,
    ).first<{ count: number }>();

    const hasUnscoredExamples = unscoredCount && unscoredCount.count > 0;

    if (!hasUnscoredExamples) {
      logger.info("No unscored training examples found for quality scoring");

      return;
    }

    const taskService = new TaskService(env, new TaskRepository(env));

    await taskService.enqueueTask({
      task_type: "training_quality_scoring",
      task_data: {
        batchSize: 100,
        minDaysOld: 1,
      },
      priority: 7,
    });

    logger.info("Training quality scoring task scheduled");
  } catch (error) {
    logger.error("Failed to schedule training quality scoring:", error);
    throw error;
  }
}
