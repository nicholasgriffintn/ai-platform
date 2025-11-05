import { z } from "zod";

export const TaskType = z.enum([
	"memory_synthesis",
	"research_polling",
	"replicate_polling",
	"async_message_polling",
]);

export const TaskStatus = z.enum([
	"pending",
	"queued",
	"running",
	"completed",
	"failed",
	"cancelled",
]);

export const ScheduleType = z.enum([
	"immediate",
	"scheduled",
	"recurring",
	"event_triggered",
]);

export const TaskExecutionStatus = z.enum(["running", "completed", "failed"]);

export const Task = z.object({
	id: z.string(),
	task_type: TaskType,
	status: TaskStatus.optional(),
	priority: z.number().min(1).max(10).optional(),
	user_id: z.number().optional(),
	task_data: z.record(z.string(), z.any()).optional(),
	schedule_type: ScheduleType.optional(),
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

export const TaskExecution = z.object({
	id: z.string(),
	task_id: z.string(),
	status: TaskExecutionStatus,
	started_at: z.string(),
	completed_at: z.string().optional(),
	execution_time_ms: z.number().optional(),
	error_message: z.string().optional(),
	result_data: z.record(z.string(), z.any()).optional(),
	created_at: z.string(),
});

export const MemorySynthesis = z.object({
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

export const CreateTaskRequest = z.object({
	task_type: TaskType,
	task_data: z.record(z.string(), z.any()),
	schedule_type: ScheduleType.optional(),
	scheduled_at: z.string().optional(),
	priority: z.number().min(1).max(10).optional(),
	metadata: z.record(z.string(), z.any()).optional(),
});

export const CreateTaskResponse = z.object({
	task_id: z.string(),
	status: TaskStatus,
	message: z.string().optional(),
});

export const GetTaskResponse = Task;

export const ListTasksResponse = z.object({
	tasks: z.array(Task),
	total: z.number(),
});

export const GetMemorySynthesisResponse = z.object({
	synthesis: MemorySynthesis.optional(),
});

export const TriggerMemorySynthesisRequest = z.object({
	namespace: z.string().optional(),
});

export type TaskType = z.infer<typeof TaskType>;
export type TaskStatus = z.infer<typeof TaskStatus>;
export type ScheduleType = z.infer<typeof ScheduleType>;
export type TaskExecutionStatus = z.infer<typeof TaskExecutionStatus>;
export type Task = z.infer<typeof Task>;
export type TaskExecution = z.infer<typeof TaskExecution>;
export type MemorySynthesis = z.infer<typeof MemorySynthesis>;
export type CreateTaskRequest = z.infer<typeof CreateTaskRequest>;
export type CreateTaskResponse = z.infer<typeof CreateTaskResponse>;
export type GetTaskResponse = z.infer<typeof GetTaskResponse>;
export type ListTasksResponse = z.infer<typeof ListTasksResponse>;
export type GetMemorySynthesisResponse = z.infer<
	typeof GetMemorySynthesisResponse
>;
export type TriggerMemorySynthesisRequest = z.infer<
	typeof TriggerMemorySynthesisRequest
>;
