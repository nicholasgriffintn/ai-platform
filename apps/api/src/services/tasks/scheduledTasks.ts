import { RepositoryManager } from "~/repositories";
import { scheduleDueRecipeExecutions } from "~/services/apps/recipes/scheduler";
import type { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";

import { TaskService } from "./TaskService";

const logger = getLogger({ prefix: "services/tasks/scheduled" });

const MIN_NEW_MEMORIES_FOR_SYNTHESIS = 5;

export async function redispatchPendingTasks(env: IEnv): Promise<number> {
  const repositories = RepositoryManager.getInstance(env);
  const taskService = new TaskService(env, repositories.tasks);
  const dispatched = await taskService.dispatchPendingTasks();

  if (dispatched > 0) {
    logger.info("Recovered pending task queue deliveries", { dispatched });
  }

  return dispatched;
}

export async function scheduleDailySynthesis(env: IEnv): Promise<void> {
  try {
    const repositories = RepositoryManager.getInstance(env);

    const result = await env.DB.prepare(
      `SELECT u.id AS id, COUNT(s.id) AS new_memory_count
       FROM user u
       INNER JOIN user_settings us ON u.id = us.user_id
       LEFT JOIN (
         SELECT user_id, MAX(created_at) AS created_at
         FROM memory_syntheses
         WHERE namespace = 'global' AND is_active = 1
         GROUP BY user_id
       ) ms ON ms.user_id = u.id
       LEFT JOIN source s
         ON s.created_by_user_id = u.id
        AND s.kind = 'memory'
        AND s.status != 'archived'
        AND COALESCE(json_extract(s.metadata, '$.namespace'), 'global') = 'global'
        AND (ms.created_at IS NULL OR s.created_at > ms.created_at)
       WHERE us.memories_save_enabled = 1
       GROUP BY u.id`,
    ).all();

    const users = result.results as Array<{ id: number; new_memory_count: number }>;

    if (!users || users.length === 0) {
      logger.info("No users with memories enabled for daily synthesis");

      return;
    }

    const taskService = new TaskService(env, repositories.tasks);
    let scheduledCount = 0;

    for (const user of users) {
      if (user.new_memory_count < MIN_NEW_MEMORIES_FOR_SYNTHESIS) {
        continue;
      }

      try {
        await taskService.enqueueTask({
          task_type: "memory_synthesis",
          user_id: user.id,
          task_data: { namespace: "global" },
          priority: 5,
        });

        scheduledCount++;
      } catch (error) {
        logger.error(`Failed to schedule synthesis for user ${user.id}:`, error);
      }
    }

    logger.info(
      `Scheduled daily synthesis for ${scheduledCount} users (out of ${users.length} total)`,
    );
  } catch (error) {
    logger.error("Failed to schedule daily synthesis:", error);
    throw error;
  }
}

export async function scheduleTrainingQualityScoring(env: IEnv): Promise<void> {
  try {
    const repositories = RepositoryManager.getInstance(env);

    const unscoredCount = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM training_examples 
			 WHERE quality_score IS NULL AND include_in_training = 1`,
    ).first<{ count: number }>();

    const hasUnscoredExamples = unscoredCount && unscoredCount.count > 0;

    if (!hasUnscoredExamples) {
      logger.info("No unscored training examples found for quality scoring");

      return;
    }

    const taskService = new TaskService(env, repositories.tasks);

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

export async function scheduleRecipeExecutions(env: IEnv): Promise<void> {
  try {
    await scheduleDueRecipeExecutions(env);
  } catch (error) {
    logger.error("Failed to schedule recipe executions:", error);
    throw error;
  }
}
