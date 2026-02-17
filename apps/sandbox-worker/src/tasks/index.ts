import { executeFeatureImplementation } from "./feature-implementation";
import { resolveSandboxTaskProfile } from "./task-profile";
import type {
	Env,
	TaskEventEmitter,
	TaskParams,
	TaskResult,
	TaskSecrets,
} from "../types";

export async function executeSandboxTask(
	params: TaskParams,
	secrets: TaskSecrets,
	env: Env,
	emitEvent?: TaskEventEmitter,
	abortSignal?: AbortSignal,
): Promise<TaskResult> {
	const profile = resolveSandboxTaskProfile(params);
	const taskParams: TaskParams = {
		...params,
		taskType: profile.taskType,
		task: profile.task,
		shouldCommit: profile.shouldCommit,
	};

	return executeFeatureImplementation(
		taskParams,
		secrets,
		env,
		emitEvent,
		abortSignal,
	);
}
