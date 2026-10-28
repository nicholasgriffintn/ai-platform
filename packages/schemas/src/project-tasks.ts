import z from "zod/v4";

import { agentModeSchema, toolPermissionSchema } from "./agent-modes.js";
import { chatRunStatusSchema } from "./chat-runs.js";
import { goalEvidenceEntrySchema, goalSchema } from "./goals.js";
import { listSchema } from "./platform/list.js";
import { outputProvenanceSchema } from "./provenance.js";
import { chatRunUsageSchema } from "./usage.js";
import {
  answerUserQuestionsSchema,
  userQuestionAnswerSchema,
  userQuestionSetSchema,
  userQuestionsSchema,
} from "./user-questions.js";

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

export const WORK_TASK_TOOL_IDS = [
  "assign_task",
  "post_update",
  "block_task",
  "request_review",
  "review_task",
  "escalate",
  "raise_case",
  "propose_hire",
  "set_budget",
  "link_pull_request",
  "answer_standup",
  "summarise_standup",
  "propose_setup_plan",
  "draft_reply",
  "answer_questions",
  "propose_breakdown",
  "accept_breakdown",
] as const;

export const WORK_AGENT_TOOL_IDS = [
  "web_search",
  "research",
  "extract_content",
  "search_documents",
  "get_document",
  "write_document",
  "write_sheet",
  "write_deck",
  "run_code",
  "use_computer",
  "store_memory",
  "search_memories",
  "discover_capabilities",
  "create_automation",
] as const;

export const WORK_RUN_EXCLUDED_TOOL_IDS: readonly string[] = ["delegate"];

export const WORK_DESKTOP_SHARED_TOOL_IDS: readonly string[] = [
  "search_documents",
  "get_document",
  "write_document",
  "write_sheet",
  "write_deck",
  "store_memory",
  "search_memories",
];

export type WorkTaskToolId = (typeof WORK_TASK_TOOL_IDS)[number];

export const PROJECT_TASK_KINDS = ["task", "case", "standup"] as const;
export const projectTaskKindSchema = z.enum(PROJECT_TASK_KINDS);
export type ProjectTaskKind = z.infer<typeof projectTaskKindSchema>;

export const PROJECT_TASK_PRIORITIES = ["none", "low", "medium", "high", "urgent"] as const;
export const projectTaskPrioritySchema = z.enum(PROJECT_TASK_PRIORITIES);
export type ProjectTaskPriority = z.infer<typeof projectTaskPrioritySchema>;

export const projectTaskPriorityLabels: Record<ProjectTaskPriority, string> = {
  none: "No priority",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const PROJECT_TASK_MAX_DEPTH = 3;
export const WORK_MAX_BREAKDOWN_ITEMS = 12;
export const WORK_MAX_AGENT_REVIEW_ROUNDS = 3;
export const workActorSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("teammate"), id: z.string().min(1) }),
  z.object({ type: z.literal("person"), userId: z.number().int().positive() }),
]);
export type WorkActor = z.infer<typeof workActorSchema>;

export const CASE_SOURCES = [
  "person",
  "teammate",
  "channel",
  "email",
  "webhook",
  "github",
  "integration",
] as const;
export const caseSourceSchema = z.enum(CASE_SOURCES);
export type CaseSource = z.infer<typeof caseSourceSchema>;

export const projectTaskCaseSchema = z.object({
  source: caseSourceSchema,
  requester: z.object({
    name: z.string().trim().min(1).max(200),
    userId: z.number().int().positive().nullable().default(null),
    teammateId: z.string().min(1).nullable().default(null),
    address: z.string().trim().max(320).nullable().default(null),
  }),
  resolution: z.string().trim().max(4000).nullable().default(null),
  resolvedAt: z.string().nullable().default(null),
  channel: z
    .object({
      bindingId: z.string(),
      threadId: z.string().nullable(),
      messageId: z.string(),
      subject: z.string().nullable(),
    })
    .nullable()
    .default(null),
  draftReply: z
    .object({
      body: z.string(),
      draftedBy: workActorSchema,
      at: z.string(),
    })
    .nullable()
    .default(null),
});
export type ProjectTaskCase = z.infer<typeof projectTaskCaseSchema>;

export const STANDUP_DEFAULT_QUESTIONS = [
  "What moved since the last standup?",
  "What's next?",
  "Anything blocking you?",
] as const;

export const standupParticipantSchema = z.object({
  actor: workActorSchema,
  name: z.string(),
});
export type StandupParticipant = z.infer<typeof standupParticipantSchema>;

export const standupAnswerSchema = z.object({
  actor: workActorSchema,
  name: z.string(),
  answers: z.array(z.object({ question: z.string(), answer: z.string() })),
  answeredAt: z.string(),
  skipped: z.boolean().optional(),
});
export type StandupAnswer = z.infer<typeof standupAnswerSchema>;

export const projectTaskStandupSchema = z.object({
  date: z.string(),
  questions: z.array(z.string().trim().min(1).max(300)).min(1).max(6),
  participants: z.array(standupParticipantSchema),
  answers: z.array(standupAnswerSchema).default([]),
  summary: z.string().nullable().default(null),
  summarisedAt: z.string().nullable().default(null),
  closesAt: z.string(),
});
export type ProjectTaskStandup = z.infer<typeof projectTaskStandupSchema>;

export const taskBreakdownItemSchema = z.object({
  key: z.string().trim().min(1).max(40),
  objective: z.string().trim().min(1).max(2000),
  owner: workActorSchema.nullable().default(null),
  dependsOn: z.array(z.string().trim().min(1).max(40)).max(WORK_MAX_BREAKDOWN_ITEMS).default([]),
  priority: projectTaskPrioritySchema.default("medium"),
});
export type TaskBreakdownItem = z.infer<typeof taskBreakdownItemSchema>;

export const taskBreakdownSchema = z.object({
  revision: z.number().int().positive(),
  items: z.array(taskBreakdownItemSchema).min(1).max(WORK_MAX_BREAKDOWN_ITEMS),
  proposedBy: workActorSchema,
  proposedAt: z.string(),
  acceptedBy: workActorSchema.nullable().default(null),
  acceptedAt: z.string().nullable().default(null),
  taskIds: z.record(z.string(), z.string()).default({}),
});
export type TaskBreakdown = z.infer<typeof taskBreakdownSchema>;

export const acceptTaskBreakdownSchema = z.object({
  revision: z.number().int().positive(),
});
export type AcceptTaskBreakdownInput = z.infer<typeof acceptTaskBreakdownSchema>;

export const PROJECT_TASK_FIX_UP_SOURCES = ["review", "ci", "pull_request_review"] as const;

export const projectTaskFixUpSchema = z.object({
  source: z.enum(PROJECT_TASK_FIX_UP_SOURCES),
  from: z.string().trim().min(1).max(200),
  note: z.string().max(8000),
  at: z.string(),
});
export type ProjectTaskFixUp = z.infer<typeof projectTaskFixUpSchema>;

export const PROJECT_TASK_CHECK_STATES = ["pending", "passing", "failing"] as const;

export const projectTaskPullRequestSchema = z.object({
  repository: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/)
    .transform((value) => value.toLowerCase()),
  number: z.number().int().positive(),
  url: z.url(),
  checks: z
    .object({
      headSha: z.string().min(1),
      state: z.enum(PROJECT_TASK_CHECK_STATES),
      failing: z
        .array(z.object({ name: z.string().min(1).max(200), url: z.url().nullable() }))
        .max(20),
      updatedAt: z.string(),
    })
    .optional(),
});
export type ProjectTaskPullRequest = z.infer<typeof projectTaskPullRequestSchema>;

export const projectTaskDetailsSchema = z.object({
  pullRequest: projectTaskPullRequestSchema.optional(),
  fixUp: projectTaskFixUpSchema.optional(),
  breakdown: taskBreakdownSchema.optional(),
  case: projectTaskCaseSchema.optional(),
  standup: projectTaskStandupSchema.optional(),
  escalation: z
    .object({
      to: workActorSchema,
      reason: z.string(),
      by: workActorSchema,
      at: z.string(),
    })
    .optional(),
  unblocker: workActorSchema.optional(),
  reviewRounds: z.number().int().nonnegative().optional(),
  handoff: z
    .object({ teammateId: z.string().min(1), version: z.number().int().nonnegative() })
    .optional(),
});
export type ProjectTaskDetails = z.infer<typeof projectTaskDetailsSchema>;

export const PROJECT_TASK_LINK_KINDS = [
  "raised_from",
  "resolved_by",
  "duplicate_of",
  "relates_to",
] as const;
export const projectTaskLinkKindSchema = z.enum(PROJECT_TASK_LINK_KINDS);
export type ProjectTaskLinkKind = z.infer<typeof projectTaskLinkKindSchema>;

export const projectTaskLinkSchema = z.object({
  id: z.string(),
  fromTaskId: z.string(),
  toTaskId: z.string(),
  kind: projectTaskLinkKindSchema,
  createdAt: z.string(),
});
export type ProjectTaskLink = z.infer<typeof projectTaskLinkSchema>;

export const createProjectTaskLinkSchema = z.object({
  toTaskId: z.string().min(1),
  kind: projectTaskLinkKindSchema,
});

export const projectTaskCommentSchema = z.object({
  body: z.string().trim().min(1).max(8000),
});
export type ProjectTaskCommentInput = z.infer<typeof projectTaskCommentSchema>;

export const raiseCaseSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(8000).nullable().default(null),
  priority: projectTaskPrioritySchema.default("none"),
  raisedFromTaskId: z.string().min(1).nullable().default(null),
});
export type RaiseCaseInput = z.infer<typeof raiseCaseSchema>;

export const sendCaseReplySchema = projectTaskCommentSchema;

export const resolveCaseSchema = z.object({
  resolution: z.string().trim().min(1).max(4000),
});

export const answerStandupSchema = z.object({
  answers: z.array(z.object({ question: z.string(), answer: z.string().trim().max(4000) })),
  skip: z.boolean().optional(),
});
export type AnswerStandupInput = z.infer<typeof answerStandupSchema>;

export const standupSettingsSchema = z.object({
  enabled: z.boolean(),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  timeZone: z.string().min(1).max(60),
  questions: z.array(z.string().trim().min(1).max(300)).min(1).max(6),
  participants: z.enum(["everyone", "people", "teammates"]),
  windowMinutes: z.number().int().min(15).max(1440),
  shareBindingId: z.string().min(1).nullable().default(null),
  pausedUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
});
export type StandupSettings = z.infer<typeof standupSettingsSchema>;

export const DEFAULT_STANDUP_SETTINGS: StandupSettings = {
  enabled: false,
  time: "09:15",
  days: [1, 2, 3, 4, 5],
  timeZone: "Europe/London",
  questions: [...STANDUP_DEFAULT_QUESTIONS],
  participants: "everyone",
  windowMinutes: 120,
  shareBindingId: null,
  pausedUntil: null,
};

export const PROJECT_TASK_INTERACTION_TOOL_IDS = ["ask_user", "request_approval"] as const;

export const TERMINAL_PROJECT_TASK_STATUSES: readonly ProjectTaskStatus[] = ["done", "cancelled"];

export function isTerminalProjectTaskStatus(status: ProjectTaskStatus): boolean {
  return TERMINAL_PROJECT_TASK_STATUSES.includes(status);
}

export const projectTaskSourceSchema = z.enum(["user", "model"]);
export type ProjectTaskSource = z.infer<typeof projectTaskSourceSchema>;

export const projectTaskRunnerKindSchema = z.enum(["conversation"]);
export type ProjectTaskRunnerKind = z.infer<typeof projectTaskRunnerKindSchema>;

export const projectTaskBlockedReasonSchema = z.enum([
  "awaiting_input",
  "awaiting_approval",
  "awaiting_takeover",
  "stalled",
  "usage_limits",
  "token_budget",
  "missing_capability",
  "dispatch_failed",
  "run_failed",
  "dependencies_unmet",
  "kill_condition_met",
  "machine_offline",
]);

export type ProjectTaskBlockedReason = z.infer<typeof projectTaskBlockedReasonSchema>;

export const RETRYABLE_PROJECT_TASK_BLOCKED_REASONS: readonly ProjectTaskBlockedReason[] = [
  "dispatch_failed",
  "run_failed",
];

export const MANAGER_HANDLED_BLOCKED_REASONS: readonly ProjectTaskBlockedReason[] = [
  "awaiting_input",
  "stalled",
  "missing_capability",
  "dispatch_failed",
  "run_failed",
  "kill_condition_met",
];

export const projectTaskBlockedReasonLabels: Record<ProjectTaskBlockedReason, string> = {
  awaiting_input: "Waiting for your answers",
  awaiting_approval: "Waiting for an approval",
  awaiting_takeover: "Waiting for computer takeover",
  stalled: "Stopped making progress",
  usage_limits: "Stopped at the usage limit",
  token_budget: "Reached its token budget",
  missing_capability: "Needs a capability it does not have",
  dispatch_failed: "Could not start the teammate run",
  run_failed: "The run failed",
  dependencies_unmet: "Waiting on another task",
  kill_condition_met: "Hit a condition that says stop",
  machine_offline: "Waiting for a machine to come online",
};

export const projectTaskStatusLabels: Record<ProjectTaskStatus, string> = {
  backlog: "Backlog",
  queued: "Queued",
  running: "Running",
  blocked: "Needs you",
  review: "Approval",
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
export const PROJECT_TASK_MAX_ASSUMPTIONS = 10;
export const PROJECT_TASK_MAX_KILL_CONDITIONS = 5;

export const projectTaskAssumptionSchema = z.object({
  id: z.string().min(1).max(60),
  statement: z.string().trim().min(1).max(500),
});
export type ProjectTaskAssumption = z.infer<typeof projectTaskAssumptionSchema>;

export const projectTaskKillConditionSchema = z.object({
  id: z.string().min(1).max(60),
  condition: z.string().trim().min(1).max(500),
});
export type ProjectTaskKillCondition = z.infer<typeof projectTaskKillConditionSchema>;

export const projectTaskAssumptionOutcomeSchema = z.enum(["held", "broke", "unknown"]);

export const projectTaskRetrospectiveSchema = z.object({
  assumptions: z.array(
    z.object({
      id: z.string().min(1),
      statement: z.string(),
      outcome: projectTaskAssumptionOutcomeSchema,
      confidence: z.number().min(0).max(1).nullable(),
    }),
  ),
  finishedAs: z.enum(["done", "cancelled"]),
  createdAt: z.string(),
});
export type ProjectTaskRetrospective = z.infer<typeof projectTaskRetrospectiveSchema>;
export const PROJECT_TASK_MAX_CONTEXT_ITEMS = 20;

export const projectTaskContextSchema = z.object({
  sourceIds: z.array(z.string().min(1)).max(PROJECT_TASK_MAX_CONTEXT_ITEMS).optional(),
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
  teammateId: z.string().min(1).nullable().default(null),
  model: z.string().min(1).nullable().default(null),
  mode: agentModeSchema.nullable().default(null),
});

export type ProjectTaskRunner = z.infer<typeof projectTaskRunnerSchema>;

export const projectTaskCompletionSchema = z.object({
  id: z.string().min(1),
  stageId: z.string().min(1).nullable(),
  conversationId: z.string().min(1),
  goalId: z.string().min(1),
  runId: z.string().min(1).nullable().optional(),
  runAttempt: z.number().int().positive().nullable().optional(),
  dispatchTaskId: z.string().min(1).nullable().optional(),
  outputIds: z.array(z.string().min(1)).optional(),
  output: z.string(),
  evidence: z.array(goalEvidenceEntrySchema).default([]),
  councilReviewIds: z.array(z.string().min(1)).optional(),
  approval: z.object({
    mode: z.enum(["human", "automated"]),
    status: z.enum(["pending", "approved", "rejected"]),
    reviewedByUserId: z.number().int().positive().nullable(),
    reviewedAt: z.string().nullable(),
  }),
  createdAt: z.string(),
});

export type ProjectTaskCompletion = z.infer<typeof projectTaskCompletionSchema>;

export const projectTaskSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  workspaceId: z.string(),
  key: z.string().nullable().default(null),
  number: z.number().int().positive().nullable().default(null),
  kind: projectTaskKindSchema.default("task"),
  objective: z.string(),
  description: z.string().nullable().default(null),
  priority: projectTaskPrioritySchema.default("none"),
  parentTaskId: z.string().nullable().default(null),
  startAt: z.string().nullable().default(null),
  dueAt: z.string().nullable().default(null),
  owner: workActorSchema.nullable().default(null),
  reviewer: workActorSchema.nullable().default(null),
  details: projectTaskDetailsSchema.default({}),
  acceptanceCriteria: z.array(projectTaskCriterionSchema).default([]),
  assumptions: z.array(projectTaskAssumptionSchema).default([]),
  killConditions: z.array(projectTaskKillConditionSchema).default([]),
  retrospective: projectTaskRetrospectiveSchema.nullable().default(null),
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
  flowSnapshot: z
    .lazy(() => projectFlowSchema)
    .nullable()
    .optional(),
  runner: projectTaskRunnerSchema.nullable(),
  executionProfile: z.literal("diff_review").nullable().optional(),
  createdByUserId: z.number().int().positive(),
  assigneeUserId: z.number().int().positive().nullable(),
  runnerIdentityUserId: z.number().int().positive().nullable(),
  conversationId: z.string().nullable(),
  originConversationId: z.string().nullable(),
  goalId: z.string().nullable(),
  dispatchTaskId: z.string().nullable(),
  runId: z.string().nullable().optional(),
  completions: z.array(projectTaskCompletionSchema).default([]),
  position: z.number(),
  tokenBudget: z.number().int().positive().nullable(),
  tokensSpent: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  attentionVersion: z.number().int().positive().optional(),
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
  return (
    task.status === "blocked" &&
    (task.blockedReason === "awaiting_input" || task.blockedReason === "awaiting_approval")
  );
}

export const projectFlowAdvanceSchema = z.enum([
  "on_goal_complete",
  "on_human_accept",
  "on_council_ship",
]);

export type ProjectFlowAdvance = z.infer<typeof projectFlowAdvanceSchema>;

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
    teammateId: z.string().trim().min(1).nullable().default(null),
    skillIds: z.array(z.string().trim().min(1)).default([]),
    mode: agentModeSchema.nullable().default(null),
    requiresApprovalFor: z.array(toolPermissionSchema).default([]),
    advance: projectFlowAdvanceSchema,
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

export function createSuggestedProjectFlow(): ProjectFlow {
  return {
    stages: [
      {
        id: "research",
        name: "Research",
        instructions:
          "Gather the context, constraints and prior art this outcome depends on. Hand off a short brief with sources and any open questions.",
        teammateId: null,
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_goal_complete",
      },
      {
        id: "plan",
        name: "Plan",
        instructions:
          "Turn the brief into a concrete plan with scope, steps and acceptance criteria. Call out risks and anything that needs a decision before work starts.",
        teammateId: null,
        skillIds: [],
        mode: "plan",
        requiresApprovalFor: [],
        advance: "on_human_accept",
      },
      {
        id: "build",
        name: "Build",
        instructions:
          "Carry out the approved plan. Keep changes within its scope and record what was done and how it was checked.",
        teammateId: null,
        skillIds: [],
        mode: "build",
        requiresApprovalFor: [],
        advance: "on_goal_complete",
      },
      {
        id: "review",
        name: "Review",
        instructions:
          "Check the work against the plan and acceptance criteria. Flag gaps, risks and anything that needs a human decision before it is accepted.",
        teammateId: null,
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_human_accept",
      },
    ],
  };
}

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

export const PROJECT_TASK_ATTENTION_KINDS = [
  "input",
  "approval",
  "review",
  "blocked",
  "assigned",
  "completion",
] as const;

export const projectTaskAttentionKindSchema = z.enum(PROJECT_TASK_ATTENTION_KINDS);
export type ProjectTaskAttentionKind = z.infer<typeof projectTaskAttentionKindSchema>;

export const projectTaskAttentionItemSchema = z.object({
  id: z.string().min(1),
  kind: projectTaskAttentionKindSchema,
  taskId: z.string(),
  projectId: z.string(),
  workspaceId: z.string(),
  projectName: z.string(),
  objective: z.string(),
  detail: z.string().nullable(),
  conversationId: z.string().nullable(),
  since: z.string(),
  requiresAction: z.boolean(),
  isRead: z.boolean(),
  readAt: z.string().nullable(),
  deepLink: z.string().min(1),
});

export type ProjectTaskAttentionItem = z.infer<typeof projectTaskAttentionItemSchema>;

export const projectTaskAttentionResponseSchema = listSchema(projectTaskAttentionItemSchema).extend(
  {
    unread: z.number().int().nonnegative(),
  },
);

export type ProjectTaskAttentionResponse = z.infer<typeof projectTaskAttentionResponseSchema>;

const objectiveField = z.string().trim().min(1).max(2000);
const taskWorkItemFields = {
  acceptanceCriteria: z
    .array(projectTaskCriterionSchema.omit({ id: true }).extend({ id: z.string().optional() }))
    .max(PROJECT_TASK_MAX_CRITERIA),
  assumptions: z
    .array(projectTaskAssumptionSchema.omit({ id: true }).extend({ id: z.string().optional() }))
    .max(PROJECT_TASK_MAX_ASSUMPTIONS),
  killConditions: z
    .array(projectTaskKillConditionSchema.omit({ id: true }).extend({ id: z.string().optional() }))
    .max(PROJECT_TASK_MAX_KILL_CONDITIONS),
  expectedOutput: z.string().trim().max(1000).nullable(),
  context: projectTaskContextSchema.nullable(),
  constraints: projectTaskConstraintsSchema.nullable(),
  dependsOnTaskIds: z.array(z.string().min(1)).max(50),
  requireApprovalFor: z.array(toolPermissionSchema).max(8),
  assigneeUserId: z.number().int().positive().nullable(),
  runner: projectTaskRunnerSchema.nullable(),
  stageId: z.string().trim().min(1).max(40).nullable(),
  tokenBudget: z.number().int().positive().max(10_000_000).nullable(),
  originConversationId: z.string().min(1).nullable(),
  description: z.string().trim().max(8000).nullable(),
  priority: projectTaskPrioritySchema,
  parentTaskId: z.string().min(1).nullable(),
  startAt: z.iso.datetime({ offset: true }).nullable(),
  dueAt: z.iso.datetime({ offset: true }).nullable(),
  owner: workActorSchema.nullable(),
  reviewer: workActorSchema.nullable(),
};

export const createProjectTaskSchema = z
  .object({
    objective: objectiveField,
    kind: projectTaskKindSchema.optional(),
    ...taskWorkItemFields,
  })
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
  assignee_user_id: z.coerce.number().int().positive().optional(),
  include_done: z.coerce.boolean().optional(),
  kind: projectTaskKindSchema.optional(),
});

export const projectTaskResponseSchema = z.object({ task: projectTaskSchema });

export const projectTaskToolApprovalSchema = z.object({
  interactionId: z.string().min(1),
  toolName: z.string().min(1),
  reason: z.string().min(1),
});

export type ProjectTaskToolApproval = z.infer<typeof projectTaskToolApprovalSchema>;

export const answerProjectTaskQuestionsSchema = answerUserQuestionsSchema;

export const resolveProjectTaskToolApprovalSchema = z.object({
  interactionId: z.string().min(1),
  resolution: z.enum(["approved", "rejected"]),
});

export type ResolveProjectTaskToolApprovalInput = z.infer<
  typeof resolveProjectTaskToolApprovalSchema
>;

export const PROJECT_TASK_INTERACTION_PROTOCOL_VERSION = 1;

export const projectTaskInteractionStatusSchema = z.enum([
  "pending",
  "resolved",
  "expired",
  "interrupted",
]);

const projectTaskInteractionBaseSchema = z.object({
  protocolVersion: z.literal(PROJECT_TASK_INTERACTION_PROTOCOL_VERSION),
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  runId: z.string().min(1).nullable(),
  interactionId: z.string().min(1),
  status: projectTaskInteractionStatusSchema,
  requestedAt: z.string(),
  resolvedAt: z.string().nullable(),
  detail: z.string().nullable(),
});

export const projectTaskQuestionInteractionSchema = projectTaskInteractionBaseSchema.extend({
  type: z.literal("question"),
  questions: userQuestionsSchema,
  answers: z.array(userQuestionAnswerSchema).nullable(),
});

export const projectTaskApprovalInteractionSchema = projectTaskInteractionBaseSchema.extend({
  type: z.literal("approval"),
  toolName: z.string().min(1),
  reason: z.string().min(1),
  resolution: z.enum(["approved", "rejected"]).nullable(),
});

export const projectTaskInteractionSchema = z.discriminatedUnion("type", [
  projectTaskQuestionInteractionSchema,
  projectTaskApprovalInteractionSchema,
]);

export type ProjectTaskInteraction = z.infer<typeof projectTaskInteractionSchema>;

export const PROJECT_TASK_ACTIVITY_PROTOCOL_VERSION = 1;

export const projectTaskActivityCategorySchema = z.enum([
  "plan",
  "run",
  "step",
  "tool",
  "interaction",
  "output",
]);

export const projectTaskActivityStatusSchema = z.enum([
  "proposed",
  "active",
  "waiting",
  "succeeded",
  "failed",
  "interrupted",
  "cancelled",
  "resolved",
  "unknown",
]);

export type ProjectTaskActivityStatus = z.infer<typeof projectTaskActivityStatusSchema>;

export const projectTaskActivityItemSchema = z.object({
  protocolVersion: z.literal(PROJECT_TASK_ACTIVITY_PROTOCOL_VERSION),
  id: z.string().min(1),
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  runId: z.string().min(1).nullable(),
  type: z.string().min(1),
  category: projectTaskActivityCategorySchema,
  status: projectTaskActivityStatusSchema,
  title: z.string().trim().min(1),
  detail: z.string().trim().min(1).nullable(),
  items: z.array(z.string().trim().min(1)).default([]),
  occurredAt: z.string(),
  sourceId: z.string().min(1).nullable(),
  actionable: z.boolean(),
  terminal: z.boolean(),
});

export type ProjectTaskActivityItem = z.infer<typeof projectTaskActivityItemSchema>;

export const projectTaskActivityTimelineSchema = z.object({
  protocolVersion: z.literal(PROJECT_TASK_ACTIVITY_PROTOCOL_VERSION),
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  items: z.array(projectTaskActivityItemSchema),
});

export type ProjectTaskActivityTimeline = z.infer<typeof projectTaskActivityTimelineSchema>;

export const PROJECT_TASK_PLAN_EVIDENCE_PROTOCOL_VERSION = 1;

export const projectTaskPlanStatusSchema = z.enum(["active", "completed", "abandoned"]);

export const projectTaskStageEvidenceStatusSchema = z.enum([
  "proposed",
  "executing",
  "completed",
  "failed",
  "interrupted",
  "abandoned",
]);

export const projectTaskStageOutputSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: z.string().min(1),
  status: z.enum(["pending", "ready", "failed", "archived"]),
});
export type ProjectTaskStageOutput = z.infer<typeof projectTaskStageOutputSchema>;

export const projectTaskStageAttemptSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  conversationId: z.string().min(1),
  attempt: z.number().int().positive(),
  status: chatRunStatusSchema,
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  terminalReason: z.string().nullable(),
  provenance: outputProvenanceSchema,
  completionIds: z.array(z.string().min(1)),
  outputs: z.array(projectTaskStageOutputSchema),
  usage: chatRunUsageSchema.optional(),
});

export const projectTaskStageEvidenceSchema = z.object({
  id: z.string().min(1),
  flowStageId: z.string().min(1).nullable(),
  name: z.string().min(1),
  status: projectTaskStageEvidenceStatusSchema,
  input: z.object({
    objective: z.string().min(1),
    acceptanceCriterionIds: z.array(z.string().min(1)),
  }),
  attempts: z.array(projectTaskStageAttemptSchema),
  completionIds: z.array(z.string().min(1)),
  outputs: z.array(projectTaskStageOutputSchema),
});

export const projectTaskResumeCapabilitySchema = z.object({
  supported: z.boolean(),
  reason: z.string().min(1).nullable(),
});

export const projectTaskPlanEvidenceSchema = z.object({
  protocolVersion: z.literal(PROJECT_TASK_PLAN_EVIDENCE_PROTOCOL_VERSION),
  id: z.string().min(1),
  status: projectTaskPlanStatusSchema,
  stages: z.array(projectTaskStageEvidenceSchema),
  resume: projectTaskResumeCapabilitySchema,
});

export type ProjectTaskPlanEvidence = z.infer<typeof projectTaskPlanEvidenceSchema>;
export type ProjectTaskStageEvidence = z.infer<typeof projectTaskStageEvidenceSchema>;
export type ProjectTaskStageAttempt = z.infer<typeof projectTaskStageAttemptSchema>;
export type ProjectTaskResumeCapability = z.infer<typeof projectTaskResumeCapabilitySchema>;

export const WORK_POST_KINDS = ["comment", "update", "event"] as const;
export const workPostKindSchema = z.enum(WORK_POST_KINDS);
export type WorkPostKind = z.infer<typeof workPostKindSchema>;

export const workPostAuthorSchema = z.object({
  kind: z.enum(["person", "teammate", "system"]),
  name: z.string(),
  userId: z.number().int().positive().nullable().default(null),
  teammateId: z.string().nullable().default(null),
});
export type WorkPostAuthor = z.infer<typeof workPostAuthorSchema>;

export const projectTaskThreadPostSchema = z.object({
  id: z.string(),
  kind: workPostKindSchema,
  author: workPostAuthorSchema,
  body: z.string(),
  createdAt: z.string(),
});
export type ProjectTaskThreadPost = z.infer<typeof projectTaskThreadPostSchema>;

export const projectTaskSummarySchema = projectTaskSchema.pick({
  id: true,
  key: true,
  kind: true,
  objective: true,
  status: true,
  priority: true,
  owner: true,
  projectId: true,
});
export type ProjectTaskSummary = z.infer<typeof projectTaskSummarySchema>;

export const projectTaskLinkedSchema = projectTaskLinkSchema.extend({
  direction: z.enum(["outgoing", "incoming"]),
  task: projectTaskSummarySchema,
});
export type ProjectTaskLinked = z.infer<typeof projectTaskLinkedSchema>;

export const projectTaskDetailResponseSchema = z.object({
  task: projectTaskSchema,
  goal: goalSchema.nullable(),
  pendingQuestions: userQuestionSetSchema.nullable(),
  pendingApproval: projectTaskToolApprovalSchema.nullable(),
  interaction: projectTaskInteractionSchema.nullable().default(null),
  activity: projectTaskActivityTimelineSchema,
  plan: projectTaskPlanEvidenceSchema,
  children: z.array(projectTaskSummarySchema).default([]),
  links: z.array(projectTaskLinkedSchema).default([]),
  outputs: z.array(projectTaskStageOutputSchema).default([]),
});

export const projectTaskThreadResponseSchema = z.object({
  thread: z.array(projectTaskThreadPostSchema),
});
export type ProjectTaskThreadResponse = z.infer<typeof projectTaskThreadResponseSchema>;

export type ProjectTaskDetailResponse = z.infer<typeof projectTaskDetailResponseSchema>;

export const projectTaskListResponseSchema = listSchema(projectTaskSchema).extend({
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
  approvedTools: z.array(z.string().min(1)).max(8).default([]),
  interaction: z
    .object({
      toolName: z.string().min(1),
      response: z.record(z.string(), z.unknown()),
    })
    .optional(),
});

export type ProjectTaskRunDispatchPayload = z.infer<typeof projectTaskRunDispatchPayloadSchema>;

export const PROJECT_TASK_DEFAULT_CONCURRENCY = 3;
export const PROJECT_TASK_DEFAULT_TOKEN_BUDGET = 400_000;
