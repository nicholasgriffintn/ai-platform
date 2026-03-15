import { resolveSandboxTaskProfile } from "./task-profile";
import { SandboxTaskRunnerRegistry } from "./runner";
import { AgentTaskRunner } from "./runners/feature-implementation-runner";
import type {
	Env,
	TaskEventEmitter,
	TaskParams,
	TaskResult,
	TaskSecrets,
} from "../types";

const runnerRegistry = new SandboxTaskRunnerRegistry();
for (const taskType of [
	"feature-implementation",
	"code-review",
	"test-suite",
	"bug-fix",
	"refactoring",
	"documentation",
	"migration",
] as const) {
	runnerRegistry.register(new AgentTaskRunner(taskType));
}

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

	const runner = runnerRegistry.resolve(profile.taskType);
	return runner.execute({
		params: taskParams,
		secrets,
		env,
		emitEvent,
		abortSignal,
	});
}
