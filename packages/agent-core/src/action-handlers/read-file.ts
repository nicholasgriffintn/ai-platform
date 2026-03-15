import type {
	ActionHandler,
	AgentActionContext,
	AgentDecision,
	AgentLoopState,
	ReadFileDecision,
	ReadFilesDecision,
} from "../types";

export interface ReadFileActionHandlerOptions<
	TShared = unknown,
	TState extends AgentLoopState = AgentLoopState,
> {
	onReadFile: (
		decision: ReadFileDecision,
		context: AgentActionContext<TShared, TState>,
	) => Promise<void>;
	onReadFiles: (
		decision: ReadFilesDecision,
		context: AgentActionContext<TShared, TState>,
	) => Promise<void>;
	name?: string;
}

export function createReadFileActionHandler<
	TShared = unknown,
	TState extends AgentLoopState = AgentLoopState,
>(
	options: ReadFileActionHandlerOptions<TShared, TState>,
): ActionHandler<ReadFileDecision | ReadFilesDecision, TShared, TState> {
	return {
		name: options.name ?? "read-file",
		canHandle: (
			decision: AgentDecision,
		): decision is ReadFileDecision | ReadFilesDecision =>
			decision.action === "read_file" || decision.action === "read_files",
		execute: async (
			decision: ReadFileDecision | ReadFilesDecision,
			context,
		) => {
			if (decision.action === "read_file") {
				await options.onReadFile(decision, context);
				return;
			}

			await options.onReadFiles(decision, context);
		},
	};
}
