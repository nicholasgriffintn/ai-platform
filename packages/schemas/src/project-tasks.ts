import z from "zod/v4";

import { agentModeSchema, toolPermissionSchema } from "./agent-modes";
import { goalSchema } from "./goals";

export const projectTaskStatusSchema = z.enum([
  "backlog",
  "queued",
  "running",
  "blocked",
  "review",
  "done",
  "cancelled",
]);

export type ProjectTaskStatus = z.infer<typeof projectTaskStatusSchema>;

export const PROJECT_TASK_TOOL_IDS = [
  "create_task",
  "get_task",
  "list_tasks",
  "update_task",
] as const;

export const TERMINAL_PROJECT_TASK_STATUSES: readonly ProjectTaskStatus[] = ["done", "cancelled"];

export function isTerminalProjectTaskStatus(status: ProjectTaskStatus): boolean {
  return TERMINAL_PROJECT_TASK_STATUSES.includes(status);
}

export const projectTaskSourceSchema = z.enum(["user", "model"]);
export type ProjectTaskSource = z.infer<typeof projectTaskSourceSchema>;

export const projectTaskRunnerKindSchema = z.enum(["conversation"]);
export type ProjectTaskRunnerKind = z.infer<typeof projectTaskRunnerKindSchema>;

export const projectTaskBlockedReasonSchema = z.enum([
  "awaiting_approval",
  "stalled",
  "usage_limits",
  "token_budget",
  "missing_capability",
  "dispatch_failed",
  "run_failed",
  "dependencies_unmet",
]);

export type ProjectTaskBlockedReason = z.infer<typeof projectTaskBlockedReasonSchema>;

export const RETRYABLE_PROJECT_TASK_BLOCKED_REASONS: readonly ProjectTaskBlockedReason[] = [
  "dispatch_failed",
  "run_failed",
];

export const projectTaskBlockedReasonLabels: Record<ProjectTaskBlockedReason, string> = {
  awaiting_approval: "Waiting for an approval",
  stalled: "Stopped making progress",
  usage_limits: "Stopped at the usage limit",
  token_budget: "Reached its token budget",
  missing_capability: "Needs a capability it does not have",
  dispatch_failed: "Could not start the agent run",
  run_failed: "The run failed",
  dependencies_unmet: "Waiting on another task",
};

export const projectTaskStatusLabels: Record<ProjectTaskStatus, string> = {
  backlog: "Backlog",
  queued: "Queued",
  running: "Running",
  blocked: "Needs you",
  review: "Review",
  done: "Done",
  cancelled: "Cancelled",
};

export type ProjectTaskActor = "user" | "model" | "system";

export const PROJECT_TASK_ACTOR_TRANSITIONS: Record<
  ProjectTaskActor,
  readonly ProjectTaskStatus[]
> = {
  user: ["backlog", "queued", "running", "blocked", "review", "done", "cancelled"],
  model: ["backlog", "review", "cancelled"],
  system: ["queued", "running", "blocked", "review"],
};

export function canActorSetProjectTaskStatus(
  actor: ProjectTaskActor,
  status: ProjectTaskStatus,
): boolean {
  return PROJECT_TASK_ACTOR_TRANSITIONS[actor].includes(status);
}

export const projectTaskCriterionSchema = z.object({
  id: z.string().min(1).max(60),
  text: z.string().trim().min(1).max(500),
});
export type ProjectTaskCriterion = z.infer<typeof projectTaskCriterionSchema>;

export const PROJECT_TASK_MAX_CRITERIA = 20;
export const PROJECT_TASK_MAX_CONTEXT_ITEMS = 20;

export const projectTaskContextSchema = z.object({
  links: z
    .array(z.object({ url: z.url(), label: z.string().trim().max(120).nullable().default(null) }))
    .max(PROJECT_TASK_MAX_CONTEXT_ITEMS)
    .default([]),
  notes: z.string().trim().max(4000).nullable().default(null),
});
export type ProjectTaskContext = z.infer<typeof projectTaskContextSchema>;

export const projectTaskConstraintsSchema = z.object({
  forbiddenTools: z.array(z.string().trim().min(1)).max(50).default([]),
  notes: z.string().trim().max(2000).nullable().default(null),
});
export type ProjectTaskConstraints = z.infer<typeof projectTaskConstraintsSchema>;

export const projectTaskRunnerSchema = z.object({
  kind: projectTaskRunnerKindSchema,
  agentId: z.string().min(1).nullable().default(null),
  model: z.string().min(1).nullable().default(null),
  mode: agentModeSchema.nullable().default(null),
});

export type ProjectTaskRunner = z.infer<typeof projectTaskRunnerSchema>;

export const projectTaskSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  workspaceId: z.string(),
  objective: z.string(),
  acceptanceCriteria: z.array(projectTaskCriterionSchema).default([]),
  expectedOutput: z.string().nullable(),
  context: projectTaskContextSchema.nullable(),
  constraints: projectTaskConstraintsSchema.nullable(),
  dependsOnTaskIds: z.array(z.string().min(1)).default([]),
  requireApprovalFor: z.array(toolPermissionSchema).default([]),
  status: projectTaskStatusSchema,
  source: projectTaskSourceSchema,
  blockedReason: projectTaskBlockedReasonSchema.nullable(),
  blockedDetail: z.string().nullable(),
  stageId: z.string().nullable(),
  runner: projectTaskRunnerSchema.nullable(),
  createdByUserId: z.number().int().positive(),
  assigneeUserId: z.number().int().positive().nullable(),
  runnerIdentityUserId: z.number().int().positive().nullable(),
  conversationId: z.string().nullable(),
  goalId: z.string().nullable(),
  dispatchTaskId: z.string().nullable(),
  position: z.number(),
  tokenBudget: z.number().int().positive().nullable(),
  tokensSpent: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
});

export type ProjectTask = z.infer<typeof projectTaskSchema>;

export function isProjectTaskRetryable(
  task: Pick<ProjectTask, "status" | "blockedReason" | "dispatchTaskId">,
): boolean {
  if (task.status === "queued") {
    return !task.dispatchTaskId;
  }

  return (
    task.status === "blocked" &&
    task.blockedReason !== null &&
    RETRYABLE_PROJECT_TASK_BLOCKED_REASONS.includes(task.blockedReason)
  );
}

export function isProjectTaskAwaitingInput(
  task: Pick<ProjectTask, "status" | "blockedReason">,
): boolean {
  return task.status === "blocked" && task.blockedReason === "stalled";
}

export const projectFlowStageSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^[a-z0-9][a-z0-9_-]*$/, "Stage ids are lowercase, and use - or _ as separators"),
    name: z.string().trim().min(1).max(60),
    instructions: z.string().trim().max(2000).nullable().default(null),
    agentId: z.string().trim().min(1).nullable().default(null),
    skillIds: z.array(z.string().trim().min(1)).default([]),
    mode: agentModeSchema.nullable().default(null),
    requiresApprovalFor: z.array(toolPermissionSchema).default([]),
    advance: z.enum(["on_goal_complete", "on_human_accept"]),
  })
  .refine((stage) => new Set(stage.skillIds).size === stage.skillIds.length, {
    error: "Stage skills must be unique",
    path: ["skillIds"],
  });

export type ProjectFlowStage = z.infer<typeof projectFlowStageSchema>;

export const PROJECT_FLOW_MAX_STAGES = 8;

export const projectFlowSchema = z
  .object({
    stages: z.array(projectFlowStageSchema).min(1).max(PROJECT_FLOW_MAX_STAGES),
  })
  .refine((flow) => new Set(flow.stages.map((stage) => stage.id)).size === flow.stages.length, {
    error: "Stage ids must be unique",
  });

export type ProjectFlow = z.infer<typeof projectFlowSchema>;

export function findFlowStage(flow: ProjectFlow | null, stageId: string | null) {
  if (!flow || !stageId) {
    return null;
  }

  return flow.stages.find((stage) => stage.id === stageId) ?? null;
}

export function nextFlowStageId(flow: ProjectFlow | null, stageId: string | null): string | null {
  if (!flow) {
    return null;
  }

  if (!stageId) {
    return flow.stages[0]?.id ?? null;
  }

  const index = flow.stages.findIndex((stage) => stage.id === stageId);

  if (index < 0 || index === flow.stages.length - 1) {
    return null;
  }

  return flow.stages[index + 1].id;
}

export const PROJECT_TASK_ATTENTION_KINDS = ["approval", "review", "blocked", "assigned"] as const;

export const projectTaskAttentionKindSchema = z.enum(PROJECT_TASK_ATTENTION_KINDS);
export type ProjectTaskAttentionKind = z.infer<typeof projectTaskAttentionKindSchema>;

export const projectTaskAttentionItemSchema = z.object({
  kind: projectTaskAttentionKindSchema,
  taskId: z.string(),
  projectId: z.string(),
  workspaceId: z.string(),
  projectName: z.string(),
  objective: z.string(),
  detail: z.string().nullable(),
  conversationId: z.string().nullable(),
  since: z.string(),
});

export type ProjectTaskAttentionItem = z.infer<typeof projectTaskAttentionItemSchema>;

export const projectTaskAttentionResponseSchema = z.object({
  items: z.array(projectTaskAttentionItemSchema),
  total: z.number().int().nonnegative(),
});

export type ProjectTaskAttentionResponse = z.infer<typeof projectTaskAttentionResponseSchema>;

const objectiveField = z.string().trim().min(1).max(2000);
const taskWorkItemFields = {
  acceptanceCriteria: z
    .array(projectTaskCriterionSchema.omit({ id: true }).extend({ id: z.string().optional() }))
    .max(PROJECT_TASK_MAX_CRITERIA),
  expectedOutput: z.string().trim().max(1000).nullable(),
  context: projectTaskContextSchema.nullable(),
  constraints: projectTaskConstraintsSchema.nullable(),
  dependsOnTaskIds: z.array(z.string().min(1)).max(50),
  requireApprovalFor: z.array(toolPermissionSchema).max(8),
  assigneeUserId: z.number().int().positive().nullable(),
  runner: projectTaskRunnerSchema.nullable(),
  stageId: z.string().trim().min(1).max(40).nullable(),
  tokenBudget: z.number().int().positive().max(10_000_000).nullable(),
};

export const createProjectTaskSchema = z
  .object({ objective: objectiveField, ...taskWorkItemFields })
  .partial(
    Object.fromEntries(Object.keys(taskWorkItemFields).map((key) => [key, true])) as Record<
      keyof typeof taskWorkItemFields,
      true
    >,
  );

export type CreateProjectTaskInput = z.infer<typeof createProjectTaskSchema>;

export const updateProjectTaskSchema = z
  .object({
    objective: objectiveField,
    status: projectTaskStatusSchema,
    position: z.number(),
    ...taskWorkItemFields,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    error: "At least one task field must be provided",
  });

export type UpdateProjectTaskInput = z.infer<typeof updateProjectTaskSchema>;

export const projectTaskListQuerySchema = z.object({
  status: projectTaskStatusSchema.optional(),
  assigneeUserId: z.coerce.number().int().positive().optional(),
  includeDone: z.coerce.boolean().optional(),
});

export const projectTaskResponseSchema = z.object({ task: projectTaskSchema });

export const projectTaskDetailResponseSchema = z.object({
  task: projectTaskSchema,
  goal: goalSchema.nullable(),
});

export type ProjectTaskDetailResponse = z.infer<typeof projectTaskDetailResponseSchema>;

export const projectTaskListResponseSchema = z.object({
  tasks: z.array(projectTaskSchema),
  flow: projectFlowSchema.nullable(),
});

export type ProjectTaskListResponse = z.infer<typeof projectTaskListResponseSchema>;

export const setProjectFlowSchema = z.object({
  flow: projectFlowSchema.nullable(),
});

export const projectFlowResponseSchema = z.object({
  flow: projectFlowSchema.nullable(),
});

export const projectTaskRunDispatchPayloadSchema = z.object({
  dispatchTaskId: z.string().min(1),
  taskId: z.string().min(1),
  projectId: z.string().min(1),
  runnerIdentityUserId: z.number().int().positive(),
  conversationId: z.string().min(1).nullable(),
});

export type ProjectTaskRunDispatchPayload = z.infer<typeof projectTaskRunDispatchPayloadSchema>;

export const PROJECT_TASK_DEFAULT_CONCURRENCY = 3;
export const PROJECT_TASK_DEFAULT_TOKEN_BUDGET = 400_000;
