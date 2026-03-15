import { getSandbox } from "@cloudflare/sandbox";
import type { SandboxTaskType, SandboxTrustLevel } from "@assistant/schemas";

import type { PolychatClient } from "../polychat-client";
import type { RunControlClient } from "../run-control-client";
import type { TaskEvent } from "../../types";
import type { PromptStrategySelection } from "./prompt-strategy";

export type SandboxInstance = ReturnType<typeof getSandbox>;
export type SandboxExecInstance = Pick<SandboxInstance, "exec">;
export type SandboxFileInstance = Pick<
	SandboxInstance,
	"readFile" | "writeFile" | "exists"
>;

export interface FileContextSnippet {
	path: string;
	snippet: string;
}

export interface RalphPrdUserStory {
	index: number;
	id?: string;
	title: string;
	description: string;
	priority?: number;
	passes: boolean;
	acceptanceCriteria: string[];
}

export interface RalphPrdContext {
	path: string;
	project?: string;
	description?: string;
	userStories: RalphPrdUserStory[];
}

export interface RepositoryContext {
	topLevelEntries: string[];
	files: FileContextSnippet[];
	taskInstructions?: FileContextSnippet;
	taskInstructionSource: "prd" | "implement" | "none";
	prdContext?: RalphPrdContext;
}

export interface ReadFileResult {
	path: string;
	startLine: number;
	endLine: number;
	content: string;
	truncated: boolean;
	error?: string;
}

export interface ExecuteAgentLoopParams {
	sandbox: SandboxInstance;
	client: PolychatClient;
	model: string;
	repoDisplayName: string;
	repoTargetDir: string;
	task: string;
	taskType: SandboxTaskType;
	promptStrategy: PromptStrategySelection;
	trustLevel?: SandboxTrustLevel;
	initialPlan: string;
	repoContext: RepositoryContext;
	executionLogs: string[];
	emit: (event: TaskEvent) => Promise<void>;
	approvalClient?: RunControlClient;
	abortSignal?: AbortSignal;
	checkpoint?: (abortMessage: string) => Promise<void>;
}

export interface QualityGateCheckResult {
	name: string;
	command: string;
	passed: boolean;
	output: string;
}

export interface QualityGateResult {
	passed: boolean;
	checks: QualityGateCheckResult[];
	summary: string;
}
