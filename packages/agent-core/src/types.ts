export interface AgentMessage {
	role: "system" | "user" | "assistant" | "tool" | "developer";
	content: string | null | Record<string, unknown> | unknown[];
}

export interface RunCommandDecision {
	action: "run_command";
	command: string;
	reasoning?: string;
}

export interface ReadFileTarget {
	path: string;
	startLine?: number;
	endLine?: number;
}

export interface ReadFileDecision extends ReadFileTarget {
	action: "read_file";
	reasoning?: string;
}

export interface ReadFilesDecision {
	action: "read_files";
	files: ReadFileTarget[];
	reasoning?: string;
}

export interface UpdatePlanDecision {
	action: "update_plan";
	plan: string;
	reasoning?: string;
}

export interface FinishDecision {
	action: "finish";
	summary: string;
	reasoning?: string;
}

export interface RunScriptDecision {
	action: "run_script";
	code: string;
	language?: "javascript" | "typescript";
	reasoning?: string;
}

export interface RunParallelDecision {
	action: "run_parallel";
	commands: string[];
	reasoning?: string;
}

export interface ToolCallInvocation {
	id?: string;
	name: string;
	arguments?: string | Record<string, unknown>;
	raw?: unknown;
}

export interface ToolCallsDecision {
	action: "tool_calls";
	toolCalls: ToolCallInvocation[];
	responseText?: string;
	reasoning?: string;
}

export type AgentDecision =
	| RunCommandDecision
	| RunParallelDecision
	| ReadFileDecision
	| ReadFilesDecision
	| UpdatePlanDecision
	| FinishDecision
	| RunScriptDecision
	| ToolCallsDecision;

export interface AgentConfig {
	maxSteps: number;
	maxRecoveryReplans: number;
	maxConsecutiveDecisionFailures: number;
	maxObservationChars: number;
}

export interface AgentEvent {
	type: string;
	[key: string]: unknown;
}

export interface AgentDecisionContext<TShared = unknown> {
	step: number;
	messages: AgentMessage[];
	shared: TShared;
	currentPlan: string;
	requiresPlanRecovery: boolean;
	recoveryReason?: string;
}

export interface AgentDecisionResult {
	decision: AgentDecision;
	rawResponse?: string;
	assistantMessage?: AgentMessage;
}

export type AgentDecisionResolver<TShared = unknown> = (
	context: AgentDecisionContext<TShared>,
) => Promise<AgentDecisionResult>;

export interface AgentLoopState {
	commandCount?: number;
	[key: string]: unknown;
}

export interface AgentActionContext<
	TShared = unknown,
	TState extends AgentLoopState = AgentLoopState,
> {
	step: number;
	messages: AgentMessage[];
	shared: TShared;
	state: TState;
	emit: (event: AgentEvent) => Promise<void>;
	guardExecution: (abortMessage: string) => Promise<void>;
	beginPlanRecovery: (reason: string) => void;
}

export interface ActionHandler<
	TDecision extends AgentDecision = AgentDecision,
	TShared = unknown,
	TState extends AgentLoopState = AgentLoopState,
> {
	name: string;
	canHandle(decision: AgentDecision): decision is TDecision;
	execute(
		decision: TDecision,
		context: AgentActionContext<TShared, TState>,
	): Promise<void>;
}

export interface ExecuteAgentLoopParams<
	TShared = unknown,
	TState extends AgentLoopState = AgentLoopState,
> {
	initialMessages: AgentMessage[];
	initialPlan: string;
	shared: TShared;
	state: TState;
	resolveDecision: AgentDecisionResolver<TShared>;
	handlers: ActionHandler<any, TShared, TState>[];
	emit?: (event: AgentEvent) => Promise<void>;
	guardExecution?: (abortMessage: string) => Promise<void>;
	config?: Partial<AgentConfig>;
	getCommandCount?: (state: TState) => number;
	serializeDecision?: (
		decision: AgentDecision,
		rawResponse?: string,
	) => AgentMessage;
	buildSummary?: (context: {
		decision: FinishDecision;
		state: TState;
		currentPlan: string;
		shared: TShared;
	}) => Promise<string> | string;
	formatInvalidDecisionMessage?: (errorMessage: string) => string;
	formatRecoveryRequiredMessage?: (recoveryReason: string) => string;
	formatRecoveryEnforcementMessage?: (recoveryReason: string) => string;
	formatPlanUpdatedMessage?: (plan: string) => string;
	onPlanRecovery?: (context: {
		reason: string;
		recoveryReplans: number;
		state: TState;
	}) => void;
}

export interface AgentLoopResult {
	summary: string;
	finalPlan: string;
	commandCount: number;
	stepsTaken: number;
}
