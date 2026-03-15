import type { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";
import {
	isSandboxRunDispatchMessage,
	processSandboxRunDispatch,
} from "~/services/apps/sandbox/dispatch";
import type { TaskHandler, TaskResult } from "../TaskHandler";
import type { TaskMessage } from "../TaskService";

const logger = getLogger({
	prefix: "services/tasks/handlers/sandbox-run-dispatch",
});

export class SandboxRunDispatchHandler implements TaskHandler {
	public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
		if (!isSandboxRunDispatchMessage(message.task_data)) {
			return {
				status: "error",
				message: "Invalid sandbox dispatch task payload",
			};
		}

		try {
			await processSandboxRunDispatch({
				env,
				message: message.task_data,
			});
			return {
				status: "success",
				message: "Sandbox run dispatch processed",
				data: {
					runId: message.task_data.runId,
				},
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error
					? error.message
					: "Sandbox dispatch processing failed";
			logger.error("Sandbox run dispatch task failed", {
				task_id: message.taskId,
				error_message: errorMessage,
			});
			return {
				status: "error",
				message: errorMessage,
			};
		}
	}
}
