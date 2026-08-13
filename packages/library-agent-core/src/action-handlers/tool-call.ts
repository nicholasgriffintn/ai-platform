import type {
	ActionHandler,
	AgentActionContext,
	AgentDecision,
	AgentLoopState,
	ToolCallsDecision,
} from "../types";

export interface ToolCallActionHandlerOptions<
	TShared = unknown,
	TState extends AgentLoopState = AgentLoopState,
> {
	onToolCalls: (
		decision: ToolCallsDecision,
		context: AgentActionContext<TShared, TState>,
	) => Promise<void>;
	name?: string;
}

export function createToolCallActionHandler<
	TShared = unknown,
	TState extends AgentLoopState = AgentLoopState,
>(
	options: ToolCallActionHandlerOptions<TShared, TState>,
): ActionHandler<ToolCallsDecision, TShared, TState> {
	return {
		name: options.name ?? "tool-call",
		canHandle: (decision: AgentDecision): decision is ToolCallsDecision =>
			decision.action === "tool_calls",
		execute: async (decision, context) => {
			await options.onToolCalls(decision, context);
		},
	};
}
