import z from "zod/v4";
import {
	SANDBOX_TIMEOUT_DEFAULT_SECONDS,
	SANDBOX_TIMEOUT_MAX_SECONDS,
	SANDBOX_TIMEOUT_MIN_SECONDS,
	sandboxTrustLevelSchema,
	sandboxRuntimeBackendSchema,
} from "./sandbox";

export const DYNAMIC_WORKER_CAPABILITIES = [
	"echo",
	"clock",
	"polychat_fetch",
] as const;

export const dynamicWorkerCapabilitySchema = z.enum(
	DYNAMIC_WORKER_CAPABILITIES,
);

export const executeDynamicWorkerRunSchema = z.object({
	task: z.string().trim().min(1),
	code: z.string().trim().min(1).optional(),
	model: z.string().trim().min(1).optional(),
	timeoutSeconds: z
		.number()
		.int()
		.min(SANDBOX_TIMEOUT_MIN_SECONDS)
		.max(SANDBOX_TIMEOUT_MAX_SECONDS)
		.default(SANDBOX_TIMEOUT_DEFAULT_SECONDS),
	trustLevel: sandboxTrustLevelSchema.optional(),
	capabilities: z.array(dynamicWorkerCapabilitySchema).optional(),
});

export const dynamicWorkerRunStatusSchema = z.enum([
	"queued",
	"running",
	"paused",
	"completed",
	"failed",
	"cancelled",
]);

export const dynamicWorkerRunEventSchema = z
	.object({
		type: z.string(),
		runId: z.string().trim().min(1),
		runtimeBackend: sandboxRuntimeBackendSchema.default("dynamic-worker"),
		timestamp: z.string().optional(),
		message: z.string().optional(),
		error: z.string().optional(),
		result: z
			.object({
				success: z.boolean().optional(),
				output: z.string().optional(),
				logs: z.string().optional(),
			})
			.catchall(z.unknown())
			.optional(),
	})
	.catchall(z.unknown());

export const dynamicWorkerRunDataSchema = z.object({
	runId: z.string().trim().min(1),
	runtimeBackend: sandboxRuntimeBackendSchema.default("dynamic-worker"),
	task: z.string().trim().min(1),
	code: z.string().optional(),
	model: z.string().optional(),
	trustLevel: sandboxTrustLevelSchema.optional(),
	capabilities: z.array(dynamicWorkerCapabilitySchema).default([]),
	status: dynamicWorkerRunStatusSchema,
	startedAt: z.string().trim().min(1),
	updatedAt: z.string().trim().min(1),
	completedAt: z.string().optional(),
	error: z.string().optional(),
	result: z
		.object({
			success: z.boolean().optional(),
			output: z.string().optional(),
			logs: z.string().optional(),
		})
		.catchall(z.unknown())
		.optional(),
	events: z.array(dynamicWorkerRunEventSchema).default([]),
	timeoutSeconds: z.number().int().positive().optional(),
	timeoutAt: z.string().optional(),
	pausedAt: z.string().optional(),
	resumedAt: z.string().optional(),
	pauseReason: z.string().optional(),
	resumeReason: z.string().optional(),
	cancelRequestedAt: z.string().optional(),
	cancellationReason: z.string().optional(),
});

export const dynamicWorkerRunSchema = dynamicWorkerRunDataSchema;

export const dynamicWorkerRunParamsSchema = z.object({
	runId: z.string().trim().min(1),
});

export const listDynamicWorkerRunsQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const listDynamicWorkerRunEventsQuerySchema = z.object({
	after: z.coerce.number().int().min(0).optional(),
});

export const pauseDynamicWorkerRunSchema = z.object({
	reason: z.string().trim().min(1).max(280).optional(),
});

export const resumeDynamicWorkerRunSchema = z.object({
	reason: z.string().trim().min(1).max(280).optional(),
});

export const cancelDynamicWorkerRunSchema = z.object({
	reason: z.string().trim().min(1).max(280).optional(),
});

export const dynamicWorkerExecuteRequestSchema = z.object({
	userId: z.number().int().positive(),
	runId: z.string().trim().min(1),
	task: z.string().trim().min(1),
	code: z.string().trim().min(1).optional(),
	model: z.string().trim().min(1).optional(),
	trustLevel: sandboxTrustLevelSchema.optional(),
	capabilities: z.array(dynamicWorkerCapabilitySchema).default([]),
	timeoutSeconds: z
		.number()
		.int()
		.min(SANDBOX_TIMEOUT_MIN_SECONDS)
		.max(SANDBOX_TIMEOUT_MAX_SECONDS)
		.optional(),
	polychatApiUrl: z.url(),
});

export type DynamicWorkerCapability = z.infer<
	typeof dynamicWorkerCapabilitySchema
>;
export type ExecuteDynamicWorkerRunPayload = z.infer<
	typeof executeDynamicWorkerRunSchema
>;
export type DynamicWorkerRunStatus = z.infer<
	typeof dynamicWorkerRunStatusSchema
>;
export type DynamicWorkerRunEvent = z.infer<typeof dynamicWorkerRunEventSchema>;
export type DynamicWorkerRunData = z.infer<typeof dynamicWorkerRunDataSchema>;
export type DynamicWorkerRun = z.infer<typeof dynamicWorkerRunSchema>;
export type DynamicWorkerRunParams = z.infer<
	typeof dynamicWorkerRunParamsSchema
>;
export type ListDynamicWorkerRunsQuery = z.infer<
	typeof listDynamicWorkerRunsQuerySchema
>;
export type ListDynamicWorkerRunEventsQuery = z.infer<
	typeof listDynamicWorkerRunEventsQuerySchema
>;
export type PauseDynamicWorkerRunPayload = z.infer<
	typeof pauseDynamicWorkerRunSchema
>;
export type ResumeDynamicWorkerRunPayload = z.infer<
	typeof resumeDynamicWorkerRunSchema
>;
export type CancelDynamicWorkerRunPayload = z.infer<
	typeof cancelDynamicWorkerRunSchema
>;
export type DynamicWorkerExecuteRequest = z.infer<
	typeof dynamicWorkerExecuteRequestSchema
>;
