export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool" | "developer" | "goal";
  content?: string | null | Record<string, unknown> | unknown[];
  name?: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
  tool_call_arguments?: string | Record<string, unknown>;
  status?: string;
  parts?: unknown[];
  refusal?: string;
  data?: unknown;
  reasoning?: unknown;
  reasoning_content?: unknown;
}

export interface AgentTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
  iterations: number;
}

export interface AgentToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  raw?: unknown;
}

export interface AgentTurn {
  toolCalls: AgentToolCall[];
  text?: string;
  assistantMessage?: AgentMessage;
  raw?: unknown;
  usage?: Partial<Omit<AgentTokenUsage, "iterations">>;
}

export interface AgentFinishAssessment {
  allow: boolean;
  instruction?: string;
  outcome?: AgentGoalOutcome;
}

export type AgentGoalOutcome = "satisfied" | "unsatisfied" | "blocked" | "stalled";

export interface AgentConfig {
  maxSteps: number;
  maxStepExtensions: number;
  maxRecoveryReplans: number;
  maxConsecutiveTurnFailures: number;
  maxObservationChars: number;
}

export interface AgentEvent {
  type: string;
  [key: string]: unknown;
}

export interface AgentTurnContext<TShared = unknown> {
  step: number;
  messages: AgentMessage[];
  shared: TShared;
  currentPlan: string;
  requiresPlanRecovery: boolean;
  recoveryReason?: string;
  usage: Readonly<AgentTokenUsage>;
  remainingTokenBudget?: number;
}

export type AgentTurnResolver<TShared = unknown> = (
  context: AgentTurnContext<TShared>,
) => Promise<AgentTurn>;

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

export type AgentToolCallExecutor<
  TShared = unknown,
  TState extends AgentLoopState = AgentLoopState,
> = (toolCalls: AgentToolCall[], context: AgentActionContext<TShared, TState>) => Promise<void>;

export interface ExecuteAgentLoopParams<
  TShared = unknown,
  TState extends AgentLoopState = AgentLoopState,
> {
  initialMessages: AgentMessage[];
  initialPlan: string;
  shared: TShared;
  state: TState;
  resolveTurn: AgentTurnResolver<TShared>;
  executeToolCalls: AgentToolCallExecutor<TShared, TState>;
  recordControlToolResults?: (
    toolCalls: AgentToolCall[],
    context: AgentActionContext<TShared, TState>,
  ) => Promise<AgentMessage[]> | AgentMessage[];
  emit?: (event: AgentEvent) => Promise<void>;
  guardExecution?: (abortMessage: string) => Promise<void>;
  config?: Partial<AgentConfig>;
  getCommandCount?: (state: TState) => number;
  buildSummary?: (context: {
    summary: string;
    state: TState;
    currentPlan: string;
    shared: TShared;
  }) => Promise<string> | string;
  assessFinish?: (context: {
    summary: string;
    step: number;
    messages: AgentMessage[];
    shared: TShared;
    state: TState;
    usage: AgentTokenUsage;
  }) => Promise<AgentFinishAssessment> | AgentFinishAssessment;
  formatMissingToolCallMessage?: (errorMessage: string) => string;
  formatRecoveryRequiredMessage?: (recoveryReason: string) => string;
  formatRecoveryEnforcementMessage?: (recoveryReason: string) => string;
  shouldAbortOnTurnError?: (error: unknown) => boolean;
  onStepBudgetExceeded?: (context: {
    step: number;
    maxSteps: number;
    currentPlan: string;
    messages: AgentMessage[];
    shared: TShared;
    state: TState;
  }) =>
    | Promise<{ extendBy: number; reason?: string } | null>
    | { extendBy: number; reason?: string }
    | null;
  onPlanRecovery?: (context: { reason: string; recoveryReplans: number; state: TState }) => void;
  tokenBudget?: number;
  onTokenUsage?: (usage: AgentTokenUsage) => Promise<void> | void;
  compactMessages?: (context: {
    step: number;
    messages: AgentMessage[];
    currentPlan: string;
    shared: TShared;
    state: TState;
  }) => Promise<AgentMessage[] | void> | AgentMessage[] | void;
}

export interface AgentLoopResult {
  summary: string;
  finalPlan: string;
  commandCount: number;
  stepsTaken: number;
  goalOutcome?: AgentGoalOutcome;
  usage: AgentTokenUsage;
}
