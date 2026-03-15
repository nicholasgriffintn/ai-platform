import type { SandboxTaskType } from "@assistant/schemas";

import type {
	Env,
	TaskEventEmitter,
	TaskParams,
	TaskResult,
	TaskSecrets,
} from "../types";

export interface SandboxTaskRunnerContext {
	params: TaskParams;
	secrets: TaskSecrets;
	env: Env;
	emitEvent?: TaskEventEmitter;
	abortSignal?: AbortSignal;
}

export interface SandboxTaskRunner {
	readonly taskType: SandboxTaskType;
	execute(context: SandboxTaskRunnerContext): Promise<TaskResult>;
}

export class SandboxTaskRunnerRegistry {
	private readonly runners = new Map<SandboxTaskType, SandboxTaskRunner>();

	public register(runner: SandboxTaskRunner): void {
		this.runners.set(runner.taskType, runner);
	}

	public resolve(taskType: SandboxTaskType): SandboxTaskRunner {
		const runner = this.runners.get(taskType);
		if (!runner) {
			throw new Error(`No sandbox task runner registered for ${taskType}`);
		}
		return runner;
	}
}
