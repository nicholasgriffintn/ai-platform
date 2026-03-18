import z from "zod/v4";
import { SANDBOX_RUN_DISPATCH_TASK_TYPE } from "./tasks";

export const SANDBOX_PROMPT_STRATEGIES = [
	"auto",
	"feature-delivery",
	"bug-fix",
	"refactor",
	"test-hardening",
] as const;
export const SANDBOX_TASK_TYPES = [
	"feature-implementation",
	"code-review",
	"test-suite",
	"bug-fix",
	"refactoring",
	"documentation",
	"migration",
] as const;

export const SANDBOX_TIMEOUT_MIN_SECONDS = 30;
export const SANDBOX_TIMEOUT_DEFAULT_SECONDS = 900;
export const SANDBOX_TIMEOUT_MAX_SECONDS = 7200;
export const SANDBOX_TRUST_LEVELS = ["strict", "balanced", "trusted"] as const;

export const sandboxWebhookCommandSchema = z.enum([
	"implement",
	"review",
	"test",
	"fix",
]);
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
	taskType: z.enum(SANDBOX_TASK_TYPES).optional(),
	model: z.string().trim().min(1).optional(),
	promptStrategy: z.enum(SANDBOX_PROMPT_STRATEGIES).optional(),
	shouldCommit: z.boolean().optional(),
	timeoutSeconds: z
		.number()
		.int()
		.min(SANDBOX_TIMEOUT_MIN_SECONDS)
		.max(SANDBOX_TIMEOUT_MAX_SECONDS)
		.optional(),
	trustLevel: z.enum(SANDBOX_TRUST_LEVELS).optional(),
});

export const sandboxRunDispatchPayloadSchema = z.object({
	installationId: z.number().int().positive(),
	repo: sandboxRepoSchema,
	task: z.string().trim().min(1),
	taskType: z.enum(SANDBOX_TASK_TYPES).optional(),
	model: z.string().trim().min(1).optional(),
	promptStrategy: z.enum(SANDBOX_PROMPT_STRATEGIES).optional(),
	shouldCommit: z.boolean(),
	timeoutSeconds: z.number().int().positive().optional(),
	trustLevel: z.enum(SANDBOX_TRUST_LEVELS).optional(),
});

export const sandboxRunDispatchMessageSchema = z.object({
	kind: z.literal(SANDBOX_RUN_DISPATCH_TASK_TYPE),
	runId: z.string().trim().min(1),
	recordId: z.string().trim().min(1),
	userId: z.number().int().positive(),
	payload: sandboxRunDispatchPayloadSchema,
});

export const autoConnectSchema = z.object({
	installationId: z.number().int().positive(),
	repositories: z.array(z.string().trim().min(1)).optional(),
});

export const sandboxRunParamsSchema = z.object({
	runId: z.string().trim().min(1),
});

export type SandboxRunParams = z.infer<typeof sandboxRunParamsSchema>;

export const listRunsQuerySchema = z.object({
	installationId: z.coerce.number().int().positive().optional(),
	repo: z.string().trim().min(1).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const listRunEventsQuerySchema = z.object({
	after: z.coerce.number().int().min(0).optional(),
});

export const listRunInstructionsQuerySchema = z.object({
	after: z.coerce.number().int().min(0).optional(),
});

export const cancelRunSchema = z.object({
	reason: z.string().trim().min(1).max(280).optional(),
});

export const sandboxRunInstructionKindSchema = z.enum([
	"message",
	"continue",
	"approval_request",
	"approval_response",
]);

export const submitRunInstructionSchema = z.object({
	kind: sandboxRunInstructionKindSchema.default("message"),
	content: z.string().trim().max(2000).optional(),
	command: z.string().trim().min(1).max(500).optional(),
	requestId: z.string().trim().min(1).optional(),
	approvalStatus: z.enum(["approved", "rejected"]).optional(),
	timeoutSeconds: z.number().int().min(5).max(1800).optional(),
	escalateAfterSeconds: z.number().int().min(1).max(900).optional(),
});

export const pauseRunSchema = z.object({
	reason: z.string().trim().min(1).max(280).optional(),
});

export const resumeRunSchema = z.object({
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
	"paused",
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
		logsArtifactKey: z.string().optional(),
		logsArtifactUrl: z.string().optional(),
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
		timeoutSeconds: z.number().int().positive().optional(),
		timeoutAt: z.string().optional(),
		result: sandboxRunResultSchema.optional(),
		approvalId: z.string().optional(),
		approvalStatus: z
			.enum(["pending", "escalated", "timed_out", "approved", "rejected"])
			.optional(),
		approvalExpiresAt: z.string().optional(),
		approvalEscalatedAt: z.string().optional(),
		approvalTimedOutAt: z.string().optional(),
		instructionId: z.string().optional(),
		instructionKind: sandboxRunInstructionKindSchema.optional(),
		instructionContent: z.string().optional(),
		repeatCount: z.number().int().positive().optional(),
		maxSteps: z.number().int().positive().optional(),
		extendedBy: z.number().int().positive().optional(),
	})
	.catchall(z.unknown());

export const sandboxRunDataSchema = z.object({
	runId: z.string().trim().min(1),
	installationId: z.number().int().positive(),
	repo: sandboxRepoSchema,
	task: z.string().trim().min(1),
	taskType: z.enum(SANDBOX_TASK_TYPES).optional(),
	model: z.string().trim().min(1),
	trustLevel: z.enum(SANDBOX_TRUST_LEVELS).optional(),
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
	timeoutSeconds: z.number().int().positive().optional(),
	timeoutAt: z.string().optional(),
	pausedAt: z.string().optional(),
	resumedAt: z.string().optional(),
	pauseReason: z.string().optional(),
	resumeReason: z.string().optional(),
	artifactKey: z.string().optional(),
	artifactUrl: z.string().optional(),
	workflowPhase: z
		.enum([
			"queued",
			"dispatching",
			"executing",
			"finalizing",
			"completed",
			"failed",
			"cancelled",
		])
		.optional(),
	queueDispatchedAt: z.string().optional(),
	processingStartedAt: z.string().optional(),
});

export const sandboxRunSchema = sandboxRunDataSchema.extend({
	events: z.array(sandboxRunEventSchema).default([]),
});

export const sandboxTaskTypeSchema = z.enum(SANDBOX_TASK_TYPES);
export const sandboxTrustLevelSchema = z.enum(SANDBOX_TRUST_LEVELS);

export const sandboxRunControlStateSchema = z.enum([
	"queued",
	"running",
	"paused",
	"cancelled",
]);

export const sandboxRunControlSchema = z.object({
	runId: z.string().trim().min(1),
	state: sandboxRunControlStateSchema,
	updatedAt: z.string().trim().min(1),
	cancellationReason: z.string().optional(),
	pauseReason: z.string().optional(),
	timeoutSeconds: z.number().int().positive().optional(),
	timeoutAt: z.string().optional(),
});

export const sandboxRunInstructionSchema = z.object({
	id: z.string().trim().min(1),
	runId: z.string().trim().min(1),
	kind: sandboxRunInstructionKindSchema,
	content: z.string().optional(),
	command: z.string().optional(),
	requestId: z.string().optional(),
	approvalStatus: z
		.enum(["pending", "escalated", "timed_out", "approved", "rejected"])
		.optional(),
	timeoutSeconds: z.number().int().positive().optional(),
	escalateAfterSeconds: z.number().int().positive().optional(),
	expiresAt: z.string().optional(),
	escalationAt: z.string().optional(),
	escalatedAt: z.string().optional(),
	timedOutAt: z.string().optional(),
	resolvedAt: z.string().optional(),
	resolutionReason: z.string().optional(),
	createdAt: z.string().trim().min(1),
});

export const sandboxRunInstructionEnvelopeSchema = z.object({
	index: z.number().int().positive(),
	recordedAt: z.string().trim().min(1),
	instruction: sandboxRunInstructionSchema,
});

export const sandboxWorkerExecuteRequestSchema = z.object({
	userId: z.number().int().positive(),
	taskType: sandboxTaskTypeSchema.optional(),
	repo: sandboxRepoSchema,
	task: z.string().trim().min(1),
	model: z.string().trim().min(1).optional(),
	promptStrategy: sandboxPromptStrategySchema.optional(),
	shouldCommit: z.boolean().optional(),
	timeoutSeconds: z
		.number()
		.int()
		.min(SANDBOX_TIMEOUT_MIN_SECONDS)
		.max(SANDBOX_TIMEOUT_MAX_SECONDS)
		.optional(),
	trustLevel: sandboxTrustLevelSchema.optional(),
	polychatApiUrl: z.url(),
	installationId: z.number().int().positive().optional(),
	runId: z.string().trim().min(1).optional(),
});

export type GitHubConnectionPayload = z.infer<typeof githubConnectionSchema>;
export type ExecuteSandboxRunPayload = z.infer<typeof executeSandboxRunSchema>;
export type SandboxRunDispatchPayload = z.infer<
	typeof sandboxRunDispatchPayloadSchema
>;
export type SandboxRunDispatchMessage = z.infer<
	typeof sandboxRunDispatchMessageSchema
>;
export type AutoConnectPayload = z.infer<typeof autoConnectSchema>;
export type ListRunsQueryPayload = z.infer<typeof listRunsQuerySchema>;
export type ListRunEventsQueryPayload = z.infer<
	typeof listRunEventsQuerySchema
>;
export type ListRunInstructionsQueryPayload = z.infer<
	typeof listRunInstructionsQuerySchema
>;
export type CancelRunPayload = z.infer<typeof cancelRunSchema>;
export type SubmitRunInstructionPayload = z.infer<
	typeof submitRunInstructionSchema
>;
export type PauseRunPayload = z.infer<typeof pauseRunSchema>;
export type ResumeRunPayload = z.infer<typeof resumeRunSchema>;

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
export type SandboxTrustLevel = z.infer<typeof sandboxTrustLevelSchema>;
export type SandboxWebhookCommand = z.infer<typeof sandboxWebhookCommandSchema>;
export type SandboxRunControlState = z.infer<
	typeof sandboxRunControlStateSchema
>;
export type SandboxRunControl = z.infer<typeof sandboxRunControlSchema>;
export type SandboxRunInstructionKind = z.infer<
	typeof sandboxRunInstructionKindSchema
>;
export type SandboxRunInstruction = z.infer<typeof sandboxRunInstructionSchema>;
export type SandboxRunInstructionEnvelope = z.infer<
	typeof sandboxRunInstructionEnvelopeSchema
>;
export type SandboxWorkerExecuteRequest = z.infer<
	typeof sandboxWorkerExecuteRequestSchema
>;

export type CreateSandboxConnectionInput = GitHubConnectionPayload;
export type ConnectSandboxInstallationInput = AutoConnectPayload;
export type ExecuteSandboxRunInput = ExecuteSandboxRunPayload;
