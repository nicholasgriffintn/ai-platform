import type { IEnv } from "~/types";
import { RepositoryManager } from "~/repositories";
import { TaskService } from "./TaskService";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/tasks/scheduled" });

/**
 * Schedule daily memory synthesis for all users with memories enabled
 */
export async function scheduleDailySynthesis(env: IEnv): Promise<void> {
	try {
		const repositories = RepositoryManager.getInstance(env);

		// Get all users with memories enabled
		const result = await env.DB.prepare(
			`SELECT DISTINCT u.id
       FROM user u
       INNER JOIN user_settings us ON u.id = us.user_id
       WHERE us.memories_save_enabled = 1`,
		).all();

		const users = result.results as Array<{ id: number }>;

		if (!users || users.length === 0) {
			logger.info("No users with memories enabled for daily synthesis");
			return;
		}

		const taskService = new TaskService(env, repositories.tasks);
		let scheduledCount = 0;

		for (const user of users) {
			try {
				// Check if user has new memories since last synthesis
				const lastSynthesis =
					await repositories.memorySyntheses.getActiveSynthesis(
						user.id,
						"global",
					);

				const newMemoryCount =
					await repositories.memorySyntheses.countMemoriesSince(
						user.id,
						lastSynthesis?.created_at,
						"global",
					);

				// Only synthesize if there are 5+ new memories
				if (newMemoryCount >= 5) {
					await taskService.enqueueTask({
						task_type: "memory_synthesis",
						user_id: user.id,
						task_data: { namespace: "global" },
						priority: 5,
					});

					scheduledCount++;
				}
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

/**
 * Cron handler for scheduled tasks
 * Add this to wrangler.jsonc:
 *
 * "triggers": {
 *   "crons": ["0 2 * * *"]  // Run at 2 AM daily
 * }
 */
export default {
	async scheduled(
		event: ScheduledEvent,
		env: IEnv,
		ctx: ExecutionContext,
	): Promise<void> {
		logger.info(`Scheduled task triggered: ${event.cron}`);

		// Daily synthesis at 2 AM
		if (event.cron === "0 2 * * *") {
			await scheduleDailySynthesis(env);
		}
	},
};
