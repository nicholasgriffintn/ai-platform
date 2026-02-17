import z from "zod/v4";

export const SANDBOX_PROMPT_STRATEGIES = [
	"auto",
	"feature-delivery",
	"bug-fix",
	"refactor",
	"test-hardening",
] as const;

export const sandboxRepoSchema = z
	.string()
	.trim()
	.min(1)
	.regex(/^[\w.-]+\/[\w.-]+$/, "repo must be in owner/repo format");

export const githubConnectionSchema = z.object({
	installationId: z.number().int().positive(),
	appId: z.string().trim().min(1),
	privateKey: z.string().trim().min(1),
	webhookSecret: z.string().trim().min(1).optional(),
	repositories: z.array(z.string().trim().min(1)).optional(),
});

export const executeSandboxRunSchema = z.object({
	installationId: z.number().int().positive(),
	repo: sandboxRepoSchema,
	task: z.string().trim().min(1),
	model: z.string().trim().min(1).optional(),
	promptStrategy: z.enum(SANDBOX_PROMPT_STRATEGIES).optional(),
	shouldCommit: z.boolean().optional(),
});

export const autoConnectSchema = z.object({
	installationId: z.number().int().positive(),
	repositories: z.array(z.string().trim().min(1)).optional(),
});

export const listRunsQuerySchema = z.object({
	installationId: z.coerce.number().int().positive().optional(),
	repo: z.string().trim().min(1).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const cancelRunSchema = z.object({
	reason: z.string().trim().min(1).max(280).optional(),
});

export const sandboxConnectionSchema = z.object({
	installationId: z.number().int().positive(),
	appId: z.string().trim().min(1),
	repositories: z.array(z.string().trim().min(1)),
	hasWebhookSecret: z.boolean(),
	createdAt: z.string().trim().min(1),
	updatedAt: z.string().trim().min(1),
});

export const sandboxInstallConfigSchema = z.object({
	installUrl: z.url().optional(),
	canAutoConnect: z.boolean(),
	callbackUrl: z.url().optional(),
});

export const sandboxRunStatusSchema = z.enum([
	"queued",
	"running",
	"completed",
	"failed",
	"cancelled",
]);

export const sandboxRunResultSchema = z
	.object({
		success: z.boolean().optional(),
		summary: z.string().optional(),
		diff: z.string().optional(),
		logs: z.string().optional(),
		error: z.string().optional(),
		errorType: z.string().optional(),
		branchName: z.string().optional(),
	})
	.catchall(z.unknown());

export const sandboxTaskResultSchema = z
	.object({
		success: z.boolean(),
		logs: z.string(),
		diff: z.string().optional(),
		summary: z.string().optional(),
		error: z.string().optional(),
		errorType: z.string().optional(),
		branchName: z.string().optional(),
	})
	.catchall(z.unknown());

export const sandboxPromptStrategySchema = z.enum(SANDBOX_PROMPT_STRATEGIES);

export const sandboxRunEventSchema = z
	.object({
		type: z.string(),
		runId: z.string().optional(),
		repo: z.string().optional(),
		installationId: z.number().int().positive().optional(),
		startedAt: z.string().optional(),
		completedAt: z.string().optional(),
		message: z.string().optional(),
		command: z.string().optional(),
		commandIndex: z.number().optional(),
		commandTotal: z.number().optional(),
		exitCode: z.number().optional(),
		branchName: z.string().optional(),
		plan: z.string().optional(),
		error: z.string().optional(),
		errorType: z.string().optional(),
		path: z.string().optional(),
		agentStep: z.number().optional(),
		action: z.string().optional(),
		reasoning: z.string().optional(),
		promptStrategy: sandboxPromptStrategySchema.optional(),
		retryable: z.boolean().optional(),
		commandCount: z.number().optional(),
		startLine: z.number().optional(),
		endLine: z.number().optional(),
		truncated: z.boolean().optional(),
		timestamp: z.string().optional(),
		result: sandboxRunResultSchema.optional(),
	})
	.catchall(z.unknown());

export const sandboxRunDataSchema = z.object({
	runId: z.string().trim().min(1),
	installationId: z.number().int().positive(),
	repo: sandboxRepoSchema,
	task: z.string().trim().min(1),
	model: z.string().trim().min(1),
	promptStrategy: sandboxPromptStrategySchema.optional(),
	shouldCommit: z.boolean(),
	status: sandboxRunStatusSchema,
	startedAt: z.string().trim().min(1),
	updatedAt: z.string().trim().min(1),
	completedAt: z.string().optional(),
	error: z.string().optional(),
	events: z.array(sandboxRunEventSchema).optional(),
	result: sandboxRunResultSchema.optional(),
	cancelRequestedAt: z.string().optional(),
	cancellationReason: z.string().optional(),
});

export const sandboxRunSchema = sandboxRunDataSchema.extend({
	events: z.array(sandboxRunEventSchema).default([]),
});

export const sandboxTaskTypeSchema = z.enum([
	"feature-implementation",
	"code-review",
]);

export const executeSandboxWorkerProxySchema = z.object({
	repo: sandboxRepoSchema,
	task: z.string().trim().min(1),
	taskType: sandboxTaskTypeSchema.optional(),
	model: z.string().trim().min(1).optional(),
	promptStrategy: sandboxPromptStrategySchema.optional(),
	shouldCommit: z.boolean().optional(),
	installationId: z.number().int().positive().optional(),
	runId: z.string().trim().min(1).optional(),
});

export const sandboxWorkerExecuteRequestSchema = z.object({
	userId: z.number().int().positive(),
	taskType: sandboxTaskTypeSchema.optional(),
	repo: sandboxRepoSchema,
	task: z.string().trim().min(1),
	model: z.string().trim().min(1).optional(),
	promptStrategy: sandboxPromptStrategySchema.optional(),
	shouldCommit: z.boolean().optional(),
	polychatApiUrl: z.url(),
	installationId: z.number().int().positive().optional(),
	runId: z.string().trim().min(1).optional(),
});

export type GitHubConnectionPayload = z.infer<typeof githubConnectionSchema>;
export type ExecuteSandboxRunPayload = z.infer<typeof executeSandboxRunSchema>;
export type AutoConnectPayload = z.infer<typeof autoConnectSchema>;
export type ListRunsQueryPayload = z.infer<typeof listRunsQuerySchema>;
export type CancelRunPayload = z.infer<typeof cancelRunSchema>;

export type SandboxConnection = z.infer<typeof sandboxConnectionSchema>;
export type SandboxInstallConfig = z.infer<typeof sandboxInstallConfigSchema>;
export type SandboxRunStatus = z.infer<typeof sandboxRunStatusSchema>;
export type SandboxRunResult = z.infer<typeof sandboxRunResultSchema>;
export type SandboxTaskResult = z.infer<typeof sandboxTaskResultSchema>;
export type SandboxRunEvent = z.infer<typeof sandboxRunEventSchema>;
export type SandboxRunData = z.infer<typeof sandboxRunDataSchema>;
export type SandboxRun = z.infer<typeof sandboxRunSchema>;
export type SandboxTaskType = z.infer<typeof sandboxTaskTypeSchema>;
export type SandboxPromptStrategy = z.infer<typeof sandboxPromptStrategySchema>;
export type ExecuteSandboxWorkerProxyPayload = z.infer<
	typeof executeSandboxWorkerProxySchema
>;
export type SandboxWorkerExecuteRequest = z.infer<
	typeof sandboxWorkerExecuteRequestSchema
>;

export type CreateSandboxConnectionInput = GitHubConnectionPayload;
export type ConnectSandboxInstallationInput = AutoConnectPayload;
export type ExecuteSandboxRunInput = ExecuteSandboxRunPayload;
