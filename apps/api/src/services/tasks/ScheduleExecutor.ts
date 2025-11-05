import { IEnv } from "~/types";
import { SCHEDULES } from "~/constants/schedules";
import { getLogger } from "~/utils/logger";
import { scheduleDailySynthesis } from "./scheduledTasks";

const logger = getLogger({ prefix: "services/tasks/schedule-executor" });

export class ScheduleExecutor {
	public static async respondToCronSchedules(
		env: IEnv,
		event: ScheduledEvent,
	): Promise<void> {
		switch (event.cron) {
			case SCHEDULES.MEMORIES_SYNTHESIS:
				const isMemorySynthesisEnabled =
					env.MEMORY_SYNTHESIS_ENABLED === "true";
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
			default:
				logger.warn(`No handler for scheduled task: ${event.cron}`);
		}
	}
}
