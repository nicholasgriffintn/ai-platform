import { RepositoryManager } from "~/repositories";
import type { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";
import { type UsageUpdateTaskPayload, UsageManager } from "~/lib/usageManager";
import type { TaskHandler, TaskResult } from "../TaskHandler";
import type { TaskMessage } from "../TaskService";

const logger = getLogger({ prefix: "services/tasks/usage-update" });

export class UsageUpdateHandler implements TaskHandler {
	public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
		const payload = message.task_data as UsageUpdateTaskPayload | undefined;

		if (!payload?.action) {
			return {
				status: "error",
				message: "Missing usage update payload",
			};
		}

		const repositories = new RepositoryManager(env);

		try {
			await this.processPayload(repositories, payload);
			return {
				status: "success",
				message: `Usage update ${payload.action} applied`,
			};
		} catch (error) {
			logger.error("Failed to process usage update task", {
				error,
				payload,
			});

			return {
				status: "error",
				message: (error as Error).message,
			};
		}
	}

	private async processPayload(
		repositories: RepositoryManager,
		payload: UsageUpdateTaskPayload,
	): Promise<void> {
		switch (payload.action) {
			case "increment_usage": {
				if (!payload.userId) {
					logger.warn("Usage update missing userId for increment_usage");
					return;
				}
				const user = await repositories.users.getUserById(payload.userId);
				if (!user) {
					logger.warn("Usage update user not found", {
						userId: payload.userId,
					});
					return;
				}
				await UsageManager.applyAuthenticatedUsageUpdate(repositories, user);
				return;
			}
			case "increment_pro_usage": {
				if (!payload.userId) {
					logger.warn("Usage update missing userId for increment_pro_usage");
					return;
				}
				const user = await repositories.users.getUserById(payload.userId);
				if (!user) {
					logger.warn("Usage update pro user not found", {
						userId: payload.userId,
					});
					return;
				}
				await UsageManager.applyProUsageUpdate(
					repositories,
					user,
					payload.usageMultiplier,
				);
				return;
			}
			case "increment_anonymous_usage": {
				if (!payload.anonymousUserId) {
					logger.warn(
						"Usage update missing anonymousUserId for increment_anonymous_usage",
					);
					return;
				}
				await UsageManager.applyAnonymousUsageUpdate(
					repositories,
					payload.anonymousUserId,
				);
				return;
			}
			case "increment_function_usage": {
				if (!payload.userId) {
					logger.warn(
						"Usage update missing userId for increment_function_usage",
					);
					return;
				}
				const user = await repositories.users.getUserById(payload.userId);
				if (!user) {
					logger.warn("Usage update function user not found", {
						userId: payload.userId,
					});
					return;
				}
				await UsageManager.applyFunctionUsageUpdate(repositories, user, {
					functionType: payload.functionType,
					isPro: payload.isProUser,
					costPerCall: payload.costPerCall,
				});
				return;
			}
			default: {
				logger.warn("Unknown usage update action", { payload });
			}
		}
	}
}
