import type { IEnv } from "~/types";
import type { TaskMessage } from "./TaskService";

export interface TaskResult {
	status: "success" | "error" | "skipped";
	message?: string;
	data?: Record<string, any>;
}

/**
 * Base interface for all task handlers
 */
export interface TaskHandler {
	/**
	 * Handle the task execution
	 */
	handle(message: TaskMessage, env: IEnv): Promise<TaskResult>;
}
