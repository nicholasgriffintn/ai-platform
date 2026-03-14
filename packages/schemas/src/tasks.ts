import { z } from "zod";

export const taskTypeSchema = z.enum([
	"memory_synthesis",
	"research_polling",
	"replicate_polling",
	"async_message_polling",
	"training_quality_scoring",
	"usage_update",
]);

export const taskStatusSchema = z.enum([
	"pending",
	"queued",
	"running",
	"completed",
	"failed",
	"cancelled",
]);

export const scheduleTypeSchema = z.enum([
	"immediate",
	"scheduled",
	"recurring",
	"event_triggered",
]);

export const taskExecutionStatusSchema = z.enum([
	"running",
	"completed",
	"failed",
]);

export const taskSchema = z.object({
	id: z.string(),
	task_type: taskTypeSchema,
	status: taskStatusSchema.optional(),
	priority: z.number().min(1).max(10).optional(),
	user_id: z.number().optional(),
	task_data: z.record(z.string(), z.any()).optional(),
	schedule_type: scheduleTypeSchema.optional(),
	scheduled_at: z.string().optional(),
	cron_expression: z.string().optional(),
	created_by: z.enum(["system", "user"]),
	attempts: z.number().optional(),
	max_attempts: z.number().optional(),
	last_attempted_at: z.string().optional(),
	completed_at: z.string().optional(),
	error_message: z.string().optional(),
	metadata: z.record(z.string(), z.any()).optional(),
	created_at: z.string(),
	updated_at: z.string().optional(),
});

export const taskExecutionSchema = z.object({
	id: z.string(),
	task_id: z.string(),
	status: taskExecutionStatusSchema,
	started_at: z.string(),
	completed_at: z.string().optional(),
	execution_time_ms: z.number().optional(),
	error_message: z.string().optional(),
	result_data: z.record(z.string(), z.any()).optional(),
	created_at: z.string(),
});

export const memorySynthesisSchema = z.object({
	id: z.string(),
	user_id: z.number(),
	synthesis_text: z.string(),
	synthesis_version: z.number().optional(),
	memory_ids: z.array(z.string()).optional(),
	memory_count: z.number().optional(),
	tokens_used: z.number().optional(),
	namespace: z.string().optional(),
	is_active: z.boolean().optional(),
	superseded_by: z.string().optional(),
	created_at: z.string(),
	updated_at: z.string().optional(),
});

export const createTaskRequestSchema = z.object({
	task_type: taskTypeSchema,
	task_data: z.record(z.string(), z.any()),
	schedule_type: scheduleTypeSchema.optional(),
	scheduled_at: z.string().optional(),
	priority: z.number().min(1).max(10).optional(),
	metadata: z.record(z.string(), z.any()).optional(),
});

export const createTaskResponseSchema = z.object({
	task_id: z.string(),
	status: taskStatusSchema,
	message: z.string().optional(),
});

export const getTaskResponseSchema = taskSchema;

export const listTasksResponseSchema = z.object({
	tasks: z.array(taskSchema),
	total: z.number(),
});

export const getMemorySynthesisResponseSchema = z.object({
	synthesis: memorySynthesisSchema.optional(),
});

export const triggerMemorySynthesisRequestSchema = z.object({
	namespace: z.string().optional(),
});

export type TaskType = z.infer<typeof taskTypeSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type ScheduleType = z.infer<typeof scheduleTypeSchema>;
export type TaskExecutionStatus = z.infer<typeof taskExecutionStatusSchema>;
export type Task = z.infer<typeof taskSchema>;
export type TaskExecution = z.infer<typeof taskExecutionSchema>;
export type MemorySynthesis = z.infer<typeof memorySynthesisSchema>;
export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>;
export type CreateTaskResponse = z.infer<typeof createTaskResponseSchema>;
export type GetTaskResponse = z.infer<typeof getTaskResponseSchema>;
export type ListTasksResponse = z.infer<typeof listTasksResponseSchema>;
export type GetMemorySynthesisResponse = z.infer<
	typeof getMemorySynthesisResponseSchema
>;
export type TriggerMemorySynthesisRequest = z.infer<
	typeof triggerMemorySynthesisRequestSchema
>;
