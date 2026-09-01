import { SCHEDULES } from "~/constants/schedules";
import { reapComposioConnectorSessions } from "~/services/apps/connectors/composio-cleanup";
import { deleteExpiredConnectorOperationApprovals } from "~/services/apps/connectors/connector-approval-cleanup";
import type { IEnv } from "~/types";
import { getErrorMessage } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

import {
  redispatchPendingTasks,
  scheduleDailyUsageReset,
  scheduleDailySynthesis,
  scheduleInfraReconciliation,
  scheduleRecipeExecutions,
  scheduleTrainingQualityScoring,
} from "./scheduledTasks";

const logger = getLogger({ prefix: "services/tasks/schedule-executor" });

export class ScheduleExecutor {
  public static async respondToCronSchedules(env: IEnv, event: ScheduledController): Promise<void> {
    try {
      await redispatchPendingTasks(env);
    } catch (error) {
      logger.warn("Pending task recovery failed", { error: getErrorMessage(error) });
    }

    switch (event.cron) {
      case SCHEDULES.USAGE_RESET:
        logger.info(`Starting daily usage reset scheduling`);
        await scheduleDailyUsageReset(env);
        await scheduleInfraReconciliation(env);
        logger.info(`Daily usage reset scheduling completed`);
        break;
      case SCHEDULES.MEMORIES_SYNTHESIS:
        const isMemorySynthesisEnabled = env.MEMORY_SYNTHESIS_ENABLED === "true";

        if (!isMemorySynthesisEnabled) {
          logger.info(
            `Memory synthesis is disabled (MEMORY_SYNTHESIS_ENABLED=${env.MEMORY_SYNTHESIS_ENABLED})`,
          );

          return;
        }

        logger.info(`Starting daily memory synthesis task`);
        await scheduleDailySynthesis(env);
        logger.info(`Daily memory synthesis task completed`);
        break;
      case SCHEDULES.TRAINING_QUALITY_SCORING:
        const isTrainingQualityScoringEnabled = env.TRAINING_QUALITY_SCORING_ENABLED === "true";

        if (!isTrainingQualityScoringEnabled) {
          logger.info(
            `Training quality scoring is disabled (TRAINING_QUALITY_SCORING_ENABLED=${env.TRAINING_QUALITY_SCORING_ENABLED})`,
          );

          return;
        }

        logger.info(`Starting training quality scoring task`);
        await scheduleTrainingQualityScoring(env);
        logger.info(`Training quality scoring task completed`);
        break;
      case SCHEDULES.RECIPE_EXECUTION:
        logger.info(`Starting due recipe execution scheduling`);
        await runRecipeScheduleAndConnectorMaintenance(env);
        logger.info(`Due recipe execution scheduling completed`);
        break;
      default:
        logger.warn(`No handler for scheduled task: ${event.cron}`);
    }
  }
}

async function runRecipeScheduleAndConnectorMaintenance(env: IEnv): Promise<void> {
  const [recipeScheduling, sessionCleanup, approvalCleanup] = await Promise.allSettled([
    scheduleRecipeExecutions(env),
    reapComposioConnectorSessions(env),
    deleteExpiredConnectorOperationApprovals(env),
  ]);

  if (sessionCleanup.status === "rejected") {
    logger.warn("Composio session cleanup failed", {
      error: getErrorMessage(sessionCleanup.reason),
    });
  }

  if (approvalCleanup.status === "rejected") {
    logger.warn("Connector approval cleanup failed", {
      error: getErrorMessage(approvalCleanup.reason),
    });
  }

  if (recipeScheduling.status === "rejected") {
    throw recipeScheduling.reason;
  }
}
