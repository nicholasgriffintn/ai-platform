import { executeFeatureImplementation } from "../feature-implementation";
import type { SandboxTaskType } from "@assistant/schemas";
import type { SandboxTaskRunner, SandboxTaskRunnerContext } from "../runner";

export class AgentTaskRunner implements SandboxTaskRunner {
	public readonly taskType: SandboxTaskType;

	constructor(taskType: SandboxTaskType) {
		this.taskType = taskType;
	}

	public execute(context: SandboxTaskRunnerContext) {
		return executeFeatureImplementation(
			context.params,
			context.secrets,
			context.env,
			context.emitEvent,
			context.abortSignal,
		);
	}
}
