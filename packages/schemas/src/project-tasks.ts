import z from "zod/v4";

import { TOOL_PERMISSIONS, toolPermissionSchema, type ToolPermission } from "./agent-modes";

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
  "dependencies_unmet",
]);

export type ProjectTaskBlockedReason = z.infer<typeof projectTaskBlockedReasonSchema>;

export const projectTaskBlockedReasonLabels: Record<ProjectTaskBlockedReason, string> = {
  awaiting_approval: "Waiting for an approval",
  stalled: "Stopped making progress",
  usage_limits: "Stopped at the usage limit",
  token_budget: "Reached its token budget",
  missing_capability: "Needs a capability it does not have",
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
  model: ["backlog", "queued", "review", "cancelled"],
  system: ["queued", "running", "blocked", "review"],
};

export function canActorSetProjectTaskStatus(
  actor: ProjectTaskActor,
  status: ProjectTaskStatus,
): boolean {
  return PROJECT_TASK_ACTOR_TRANSITIONS[actor].includes(status);
}

export const projectTaskEffortSchema = z.enum(["quick", "standard", "thorough"]);
export type ProjectTaskEffort = z.infer<typeof projectTaskEffortSchema>;

export const PROJECT_TASK_EFFORT_BUDGETS: Record<ProjectTaskEffort, number> = {
  quick: 100_000,
  standard: 400_000,
  thorough: 1_500_000,
};

export const projectTaskEffortLabels: Record<ProjectTaskEffort, string> = {
  quick: "Quick",
  standard: "Standard",
  thorough: "Thorough",
};

export const projectTaskCapabilitySchema = z.enum([
  "web_access",
  "code_execution",
  "file_editing",
  "external_actions",
]);
export type ProjectTaskCapability = z.infer<typeof projectTaskCapabilitySchema>;

export const projectTaskCapabilityLabels: Record<ProjectTaskCapability, string> = {
  web_access: "Web and API calls",
  code_execution: "Code execution",
  file_editing: "File editing",
  external_actions: "External actions",
};

export const PROJECT_TASK_BASELINE_PERMISSIONS: readonly ToolPermission[] = [
  "read",
  "reasoning",
  "human",
];

export const PROJECT_TASK_CAPABILITY_PERMISSIONS: Record<
  ProjectTaskCapability,
  readonly ToolPermission[]
> = {
  web_access: ["network"],
  code_execution: ["sandbox"],
  file_editing: ["write"],
  external_actions: ["orchestration", "delegate"],
};

export const PROJECT_TASK_DEFAULT_CAPABILITIES: readonly ProjectTaskCapability[] = [
  "web_access",
  "file_editing",
];

export function permissionsForCapabilities(
  capabilities: readonly ProjectTaskCapability[],
): ToolPermission[] {
  const allowed = new Set<ToolPermission>(PROJECT_TASK_BASELINE_PERMISSIONS);

  for (const capability of capabilities) {
    for (const permission of PROJECT_TASK_CAPABILITY_PERMISSIONS[capability]) {
      allowed.add(permission);
    }
  }

  return [...allowed];
}

export const projectTaskConsequenceSchema = z.enum([
  "publish",
  "message_people",
  "spend_money",
  "modify_external_data",
  "delete",
  "merge_or_deploy",
]);
export type ProjectTaskConsequence = z.infer<typeof projectTaskConsequenceSchema>;

export const projectTaskConsequenceLabels: Record<ProjectTaskConsequence, string> = {
  publish: "Publish something",
  message_people: "Message people",
  spend_money: "Spend money",
  modify_external_data: "Change data in another system",
  delete: "Delete something",
  merge_or_deploy: "Merge or deploy",
};

export const PROJECT_TASK_CONSEQUENCE_PERMISSIONS: Record<
  ProjectTaskConsequence,
  readonly ToolPermission[]
> = {
  publish: ["network"],
  message_people: ["network"],
  spend_money: ["network"],
  modify_external_data: ["network"],
  delete: ["network"],
  merge_or_deploy: ["sandbox", "orchestration"],
};

export const PROJECT_TASK_DEFAULT_CONSEQUENCES: readonly ProjectTaskConsequence[] = [
  "publish",
  "message_people",
  "spend_money",
  "modify_external_data",
  "delete",
  "merge_or_deploy",
];

export function permissionsForConsequences(
  consequences: readonly ProjectTaskConsequence[],
): ToolPermission[] {
  const required = new Set<ToolPermission>();

  for (const consequence of consequences) {
    for (const permission of PROJECT_TASK_CONSEQUENCE_PERMISSIONS[consequence]) {
      required.add(permission);
    }
  }

  return [...required];
}

export const projectTaskPrioritySchema = z.enum(["low", "normal", "high"]);
export type ProjectTaskPriority = z.infer<typeof projectTaskPrioritySchema>;

export const projectTaskDeliverableKindSchema = z.enum([
  "pull_request",
  "document",
  "analysis",
  "message",
  "data",
  "other",
]);
export type ProjectTaskDeliverableKind = z.infer<typeof projectTaskDeliverableKindSchema>;

export const projectTaskDeliverableSchema = z.object({
  kind: projectTaskDeliverableKindSchema,
  description: z.string().trim().max(500).nullable().default(null),
});
export type ProjectTaskDeliverable = z.infer<typeof projectTaskDeliverableSchema>;

const DELIVERABLE_HINTS: [ProjectTaskDeliverableKind, RegExp][] = [
  ["pull_request", /\b(pull request|\bpr\b|patch|refactor|implement|fix the bug|migrate)\b/i],
  ["message", /\b(email|message|reply|announce|post|notify|slack)\b/i],
  ["analysis", /\b(analys|investigat|compare|evaluate|assess|review the)\b/i],
  ["data", /\b(dataset|export|spreadsheet|csv|query|numbers)\b/i],
  ["document", /\b(draft|write|document|note|spec|summary|report|brief)\b/i],
];

export function inferDeliverableKind(objective: string): ProjectTaskDeliverableKind | "" {
  const text = objective.trim();

  if (!text) {
    return "";
  }

  for (const [kind, pattern] of DELIVERABLE_HINTS) {
    if (pattern.test(text)) {
      return kind;
    }
  }

  return "";
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
  mode: z.string().min(1).nullable().default(null),
});

export type ProjectTaskRunner = z.infer<typeof projectTaskRunnerSchema>;

export const projectTaskSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  workspaceId: z.string(),
  objective: z.string(),
  acceptance: z.string().nullable(),
  acceptanceCriteria: z.array(projectTaskCriterionSchema).default([]),
  deliverable: projectTaskDeliverableSchema.nullable(),
  context: projectTaskContextSchema.nullable(),
  constraints: projectTaskConstraintsSchema.nullable(),
  dependsOnTaskIds: z.array(z.string().min(1)).default([]),
  requireApprovalFor: z.array(toolPermissionSchema).default([]),
  capabilities: z.array(projectTaskCapabilitySchema).default([]),
  approvalConsequences: z.array(projectTaskConsequenceSchema).default([]),
  effort: projectTaskEffortSchema,
  priority: projectTaskPrioritySchema,
  dueAt: z.string().nullable(),
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
  advance: z.enum(["on_goal_complete", "on_human_accept"]),
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
const acceptanceField = z.string().trim().max(4000);

const taskWorkItemFields = {
  acceptance: acceptanceField.nullable(),
  acceptanceCriteria: z
    .array(projectTaskCriterionSchema.omit({ id: true }).extend({ id: z.string().optional() }))
    .max(PROJECT_TASK_MAX_CRITERIA),
  deliverable: projectTaskDeliverableSchema.nullable(),
  context: projectTaskContextSchema.nullable(),
  constraints: projectTaskConstraintsSchema.nullable(),
  dependsOnTaskIds: z.array(z.string().min(1)).max(50),
  requireApprovalFor: z.array(toolPermissionSchema).max(TOOL_PERMISSIONS.length),
  capabilities: z.array(projectTaskCapabilitySchema).max(10),
  approvalConsequences: z.array(projectTaskConsequenceSchema).max(10),
  effort: projectTaskEffortSchema,
  priority: projectTaskPrioritySchema,
  dueAt: z.iso.datetime().nullable(),
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
