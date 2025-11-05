import type { IEnv } from "~/types";
import { RepositoryManager } from "~/repositories";
import { TaskService } from "./TaskService";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/tasks/scheduled" });

export async function scheduleDailySynthesis(env: IEnv): Promise<void> {
	try {
		const repositories = RepositoryManager.getInstance(env);

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
				logger.error(
					`Failed to schedule synthesis for user ${user.id}:`,
					error,
				);
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
