export interface TaskParams {
	userId: number;
	taskType: "feature-implementation" | "code-review";
	repo: string;
	task: string;
	model?: string;
	shouldCommit?: boolean;
	polychatApiUrl: string;
	installationId?: number;
	runId?: string;
}

export interface TaskSecrets {
	userToken: string;
	githubToken?: string;
}

export interface TaskResult {
	success: boolean;
	logs: string;
	diff?: string;
	summary?: string;
	error?: string;
	errorType?: string;
	branchName?: string;
}

export interface TaskEvent {
	type: string;
	runId?: string;
	repo?: string;
	installationId?: number;
	startedAt?: string;
	completedAt?: string;
	message?: string;
	command?: string;
	commandIndex?: number;
	commandTotal?: number;
	exitCode?: number;
	branchName?: string;
	plan?: string;
	error?: string;
	errorType?: string;
	path?: string;
	agentStep?: number;
	action?: string;
	reasoning?: string;
	retryable?: boolean;
	commandCount?: number;
	startLine?: number;
	endLine?: number;
	truncated?: boolean;
	result?: TaskResult;
	[key: string]: unknown;
}

export type TaskEventEmitter = (event: TaskEvent) => Promise<void> | void;

export interface Env {
	Sandbox: DurableObjectNamespace<import("./index").Sandbox>;
	JWT_SECRET?: string;
}
