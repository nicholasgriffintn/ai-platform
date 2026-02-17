import { getSandbox } from "@cloudflare/sandbox";

import type { PolychatClient } from "../polychat-client";
import type { TaskEvent } from "../../types";

export type SandboxInstance = ReturnType<typeof getSandbox>;

export interface RunCommandDecision {
	action: "run_command";
	command: string;
	reasoning?: string;
}

export interface ReadFileDecision {
	action: "read_file";
	path: string;
	startLine?: number;
	endLine?: number;
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

export type AgentDecision =
	| RunCommandDecision
	| ReadFileDecision
	| UpdatePlanDecision
	| FinishDecision;

export interface FileContextSnippet {
	path: string;
	snippet: string;
}

export interface RepositoryContext {
	topLevelEntries: string[];
	files: FileContextSnippet[];
	taskInstructions?: FileContextSnippet;
	taskInstructionSource: "prd" | "implement" | "none";
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
	initialPlan: string;
	repoContext: RepositoryContext;
	executionLogs: string[];
	emit: (event: TaskEvent) => Promise<void>;
}
