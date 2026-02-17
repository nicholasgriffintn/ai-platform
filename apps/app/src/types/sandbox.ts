export interface SandboxConnection {
	installationId: number;
	appId: string;
	repositories: string[];
	hasWebhookSecret: boolean;
	createdAt: string;
	updatedAt: string;
}

export type SandboxRunStatus =
	| "queued"
	| "running"
	| "completed"
	| "failed"
	| "cancelled";

export interface SandboxRunResult {
	success?: boolean;
	summary?: string;
	diff?: string;
	logs?: string;
	error?: string;
	errorType?: string;
	branchName?: string;
	[key: string]: unknown;
}

export interface SandboxRun {
	runId: string;
	installationId: number;
	repo: string;
	task: string;
	model: string;
	shouldCommit: boolean;
	status: SandboxRunStatus;
	startedAt: string;
	updatedAt: string;
	completedAt?: string;
	error?: string;
	result?: SandboxRunResult;
	events: SandboxRunEvent[];
}

export interface SandboxRunEvent {
	type: string;
	runId?: string;
	message?: string;
	error?: string;
	command?: string;
	commandIndex?: number;
	commandTotal?: number;
	branchName?: string;
	plan?: string;
	path?: string;
	agentStep?: number;
	action?: string;
	reasoning?: string;
	retryable?: boolean;
	result?: SandboxRunResult;
	[key: string]: unknown;
}

export interface CreateSandboxConnectionInput {
	installationId: number;
	appId: string;
	privateKey: string;
	webhookSecret?: string;
	repositories?: string[];
}

export interface ConnectSandboxInstallationInput {
	installationId: number;
	repositories?: string[];
}

export interface SandboxInstallConfig {
	installUrl?: string;
	canAutoConnect: boolean;
	callbackUrl?: string;
}

export interface ExecuteSandboxRunInput {
	installationId: number;
	repo: string;
	task: string;
	model?: string;
	shouldCommit?: boolean;
}
