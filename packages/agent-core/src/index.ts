export { executeAgentLoop } from "./agent-loop";
export { parseAgentDecision } from "./decision";
export {
	resolveApproval,
	type ApprovalClient,
	type ApprovalControlState,
	type ApprovalRecord,
	type ApprovalWindow,
	type ResolveApprovalParams,
	type ResolveApprovalResult,
} from "./approval";

export {
	createCommandActionHandler,
	type CommandActionHandlerOptions,
} from "./action-handlers/command";
export {
	createReadFileActionHandler,
	type ReadFileActionHandlerOptions,
} from "./action-handlers/read-file";
export {
	createToolCallActionHandler,
	type ToolCallActionHandlerOptions,
} from "./action-handlers/tool-call";

export type {
	ActionHandler,
	AgentActionContext,
	AgentConfig,
	AgentDecision,
	AgentDecisionContext,
	AgentDecisionResolver,
	AgentDecisionResult,
	AgentEvent,
	AgentLoopResult,
	AgentLoopState,
	AgentMessage,
	ExecuteAgentLoopParams,
	FinishDecision,
	ReadFileDecision,
	ReadFileTarget,
	ReadFilesDecision,
	RunCommandDecision,
	RunParallelDecision,
	RunScriptDecision,
	ToolCallInvocation,
	ToolCallsDecision,
	UpdatePlanDecision,
} from "./types";
