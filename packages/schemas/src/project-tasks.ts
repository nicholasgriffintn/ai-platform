import z from "zod/v4";

import { toolPermissionSchema } from "./agent-modes";

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

export const PROJECT_TASK_BOARD_COLUMNS: readonly ProjectTaskStatus[] = [
  "backlog",
  "queued",
  "running",
  "blocked",
  "review",
  "done",
];

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
  "run_failed",
]);

export type ProjectTaskBlockedReason = z.infer<typeof projectTaskBlockedReasonSchema>;

export const projectTaskBlockedReasonLabels: Record<ProjectTaskBlockedReason, string> = {
  awaiting_approval: "Waiting for an approval",
  stalled: "Stopped making progress",
  usage_limits: "Stopped at the usage limit",
  token_budget: "Reached its token budget",
  missing_capability: "Needs a capability it does not have",
  run_failed: "The run failed",
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
  model: ["backlog", "queued", "review", "cancelled"],
  system: ["queued", "running", "blocked", "review"],
};

export function canActorSetProjectTaskStatus(
  actor: ProjectTaskActor,
  status: ProjectTaskStatus,
): boolean {
  return PROJECT_TASK_ACTOR_TRANSITIONS[actor].includes(status);
}

export const projectTaskRunnerSchema = z.object({
  kind: projectTaskRunnerKindSchema,
  agentId: z.string().min(1).nullable().default(null),
  model: z.string().min(1).nullable().default(null),
  mode: z.string().min(1).nullable().default(null),
});

export type ProjectTaskRunner = z.infer<typeof projectTaskRunnerSchema>;

export const projectTaskSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  workspaceId: z.string(),
  objective: z.string(),
  acceptance: z.string().nullable(),
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
  position: z.number(),
  tokenBudget: z.number().int().positive().nullable(),
  tokensSpent: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
});

export type ProjectTask = z.infer<typeof projectTaskSchema>;

export const projectFlowStageSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9][a-z0-9_-]*$/, "Stage ids are lowercase, and use - or _ as separators"),
  name: z.string().trim().min(1).max(60),
  agentId: z.string().trim().min(1).nullable().default(null),
  skillId: z.string().trim().min(1).nullable().default(null),
  mode: z.string().trim().min(1).nullable().default(null),
  requiresApprovalFor: z.array(toolPermissionSchema).default([]),
  advance: z.enum(["on_goal_complete", "on_human_accept", "on_stage_routing"]),
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

export const STAGE_ROUTING_TAG = "stage_next";

export interface StageRouting {
  nextStageId: string | null;
  reason?: string;
}

export function extractStageRouting(
  content: string,
  stageIds: ReadonlySet<string>,
): StageRouting | null {
  const match = content.match(
    new RegExp(`<${STAGE_ROUTING_TAG}>\\s*([\\s\\S]*?)\\s*</${STAGE_ROUTING_TAG}>`, "i"),
  );

  if (!match) {
    return null;
  }

  let payload: unknown;

  try {
    payload = JSON.parse(match[1] ?? "");
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const candidate = payload as { nextStageId?: unknown; reason?: unknown };
  const nextStageId =
    typeof candidate.nextStageId === "string" && stageIds.has(candidate.nextStageId)
      ? candidate.nextStageId
      : null;

  return {
    nextStageId,
    reason: typeof candidate.reason === "string" ? candidate.reason.trim() : undefined,
  };
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
const acceptanceField = z.string().trim().max(4000);

export const createProjectTaskSchema = z.object({
  objective: objectiveField,
  acceptance: acceptanceField.nullable().optional(),
  assigneeUserId: z.number().int().positive().nullable().optional(),
  runner: projectTaskRunnerSchema.nullable().optional(),
  stageId: z.string().trim().min(1).max(40).nullable().optional(),
  tokenBudget: z.number().int().positive().max(10_000_000).nullable().optional(),
});

export type CreateProjectTaskInput = z.infer<typeof createProjectTaskSchema>;

export const updateProjectTaskSchema = z
  .object({
    objective: objectiveField,
    acceptance: acceptanceField.nullable(),
    status: projectTaskStatusSchema,
    assigneeUserId: z.number().int().positive().nullable(),
    runner: projectTaskRunnerSchema.nullable(),
    stageId: z.string().trim().min(1).max(40).nullable(),
    tokenBudget: z.number().int().positive().max(10_000_000).nullable(),
    position: z.number(),
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
  taskId: z.string().min(1),
  projectId: z.string().min(1),
  runnerIdentityUserId: z.number().int().positive(),
});

export type ProjectTaskRunDispatchPayload = z.infer<typeof projectTaskRunDispatchPayloadSchema>;

export const PROJECT_TASK_DEFAULT_CONCURRENCY = 3;
export const PROJECT_TASK_DEFAULT_TOKEN_BUDGET = 400_000;
