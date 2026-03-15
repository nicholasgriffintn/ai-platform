import type {
	ActionHandler,
	AgentActionContext,
	AgentDecision,
	AgentLoopState,
	RunCommandDecision,
	RunParallelDecision,
	RunScriptDecision,
} from "../types";

export interface CommandActionHandlerOptions<
	TShared = unknown,
	TState extends AgentLoopState = AgentLoopState,
> {
	onRunCommand: (
		decision: RunCommandDecision,
		context: AgentActionContext<TShared, TState>,
	) => Promise<void>;
	onRunParallel: (
		decision: RunParallelDecision,
		context: AgentActionContext<TShared, TState>,
	) => Promise<void>;
	onRunScript: (
		decision: RunScriptDecision,
		context: AgentActionContext<TShared, TState>,
	) => Promise<void>;
	name?: string;
}

export function createCommandActionHandler<
	TShared = unknown,
	TState extends AgentLoopState = AgentLoopState,
>(
	options: CommandActionHandlerOptions<TShared, TState>,
): ActionHandler<
	RunCommandDecision | RunParallelDecision | RunScriptDecision,
	TShared,
	TState
> {
	return {
		name: options.name ?? "command",
		canHandle: (
			decision: AgentDecision,
		): decision is
			| RunCommandDecision
			| RunParallelDecision
			| RunScriptDecision =>
			decision.action === "run_command" ||
			decision.action === "run_parallel" ||
			decision.action === "run_script",
		execute: async (
			decision: RunCommandDecision | RunParallelDecision | RunScriptDecision,
			context,
		) => {
			switch (decision.action) {
				case "run_command":
					await options.onRunCommand(decision, context);
					return;
				case "run_parallel":
					await options.onRunParallel(decision, context);
					return;
				case "run_script":
					await options.onRunScript(decision, context);
					return;
			}
		},
	};
}
