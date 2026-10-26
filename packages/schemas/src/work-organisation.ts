import z from "zod/v4";

import { recipeConnectorProviderSchema } from "./apps.js";
import { listSchema } from "./platform/list.js";
import {
  projectTaskPrioritySchema,
  projectTaskSchema,
  standupSettingsSchema,
  workActorSchema,
} from "./project-tasks.js";
import { workWakeReasonSchema } from "./tasks.js";

export const EMPLOYMENT_STATUSES = ["proposed", "active", "paused", "archived"] as const;
export const employmentStatusSchema = z.enum(EMPLOYMENT_STATUSES);
export type EmploymentStatus = z.infer<typeof employmentStatusSchema>;

export const employmentPauseReasonSchema = z.enum(["manual", "budget"]);
export type EmploymentPauseReason = z.infer<typeof employmentPauseReasonSchema>;

export const RUNS_ON_KINDS = ["hosted", "sandbox", "machine", "harness"] as const;
export const runsOnSchema = z.enum(RUNS_ON_KINDS);
export type RunsOn = z.infer<typeof runsOnSchema>;

export const WORK_BUDGET_WARNING_RATIO = 0.8;
export const WORK_HEARTBEAT_MIN_MINUTES = 15;
export const WORK_HEARTBEAT_MAX_MINUTES = 24 * 60;
export const WORK_WAKE_QUIET_MINUTES = 5;
export const WORK_WATCHDOG_GRACE_MINUTES = 30;

export const hireProposalSchema = z.object({
  reason: z.string(),
  proposedByTeammateId: z.string().nullable(),
  proposedByUserId: z.number().int().positive().nullable(),
  roleSlug: z.string().nullable(),
  jobDescription: z.string().nullable(),
  projectIds: z.array(z.string()),
  proposedAt: z.string(),
});
export type HireProposal = z.infer<typeof hireProposalSchema>;

export const workWakeRecordSchema = z.object({
  at: z.string(),
  projectId: z.string(),
  reason: workWakeReasonSchema,
  taskId: z.string().nullable(),
  settled: z.boolean(),
});
export type WorkWakeRecord = z.infer<typeof workWakeRecordSchema>;

export const workspaceTeammateSchema = z.object({
  workspaceId: z.string(),
  teammateId: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  characterId: z.string().nullable(),
  title: z.string(),
  reportsToTeammateId: z.string().nullable(),
  status: employmentStatusSchema,
  pausedReason: employmentPauseReasonSchema.nullable(),
  responsibleUserId: z.number().int().positive(),
  heartbeatMinutes: z.number().int().positive().nullable(),
  lastHeartbeatAt: z.string().nullable(),
  lastWake: workWakeRecordSchema.nullable(),
  monthlyCreditCapMicros: z.number().int().positive().nullable(),
  spentCreditMicros: z.number().int().nonnegative(),
  isLead: z.boolean(),
  runsOn: runsOnSchema,
  proposal: hireProposalSchema.nullable(),
  projectIds: z.array(z.string()),
  createdAt: z.string(),
});
export type WorkspaceTeammate = z.infer<typeof workspaceTeammateSchema>;

export const workspaceTeamResponseSchema = z.object({
  teammates: z.array(workspaceTeammateSchema),
  monthlyCreditCapMicros: z.number().int().positive().nullable(),
  leadTeammateId: z.string().nullable(),
});
export type WorkspaceTeamResponse = z.infer<typeof workspaceTeamResponseSchema>;

export const workspaceTeamDirectoryEntrySchema = workspaceTeammateSchema.pick({
  teammateId: true,
  name: true,
  title: true,
  status: true,
  reportsToTeammateId: true,
  projectIds: true,
});
export type WorkspaceTeamDirectoryEntry = z.infer<typeof workspaceTeamDirectoryEntrySchema>;

export const workspaceTeamDirectoryResponseSchema = z.object({
  teammates: z.array(workspaceTeamDirectoryEntrySchema),
  leadTeammateId: z.string().nullable(),
});
export type WorkspaceTeamDirectoryResponse = z.infer<typeof workspaceTeamDirectoryResponseSchema>;

export const updateWorkspaceTeammateSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    reportsToTeammateId: z.string().min(1).nullable(),
    heartbeatMinutes: z
      .number()
      .int()
      .min(WORK_HEARTBEAT_MIN_MINUTES)
      .max(WORK_HEARTBEAT_MAX_MINUTES)
      .nullable(),
    monthlyCreditCapMicros: z.number().int().positive().nullable(),
    status: z.enum(["active", "paused", "archived"]),
    projectIds: z.array(z.string().min(1)).max(50),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    error: "Change at least one field",
  });
export type UpdateWorkspaceTeammateInput = z.infer<typeof updateWorkspaceTeammateSchema>;

export const proposeHireSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(80),
    roleSlug: z.string().min(1).nullable().default(null),
    jobDescription: z.string().trim().max(4000).nullable().default(null),
    reportsToTeammateId: z.string().min(1).nullable().default(null),
    monthlyCreditCapMicros: z.number().int().positive().nullable().default(null),
    heartbeatMinutes: z
      .number()
      .int()
      .min(WORK_HEARTBEAT_MIN_MINUTES)
      .max(WORK_HEARTBEAT_MAX_MINUTES)
      .nullable()
      .default(null),
    projectIds: z.array(z.string().min(1)).max(20).default([]),
    reason: z.string().trim().min(1).max(2000),
  })
  .refine((value) => value.roleSlug || value.jobDescription, {
    error: "Choose a role or describe the job",
  });
export type ProposeHireInput = z.infer<typeof proposeHireSchema>;

export const decideHireSchema = z.object({ decision: z.enum(["approve", "reject"]) });

export const INITIATIVE_STATUSES = ["active", "completed", "archived"] as const;
export const initiativeStatusSchema = z.enum(INITIATIVE_STATUSES);

export const initiativeSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  description: z.string(),
  status: initiativeStatusSchema,
  targetDate: z.string().nullable(),
  ownerTeammateId: z.string().nullable(),
  projectIds: z.array(z.string()),
  progress: z.object({
    done: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});
export type Initiative = z.infer<typeof initiativeSchema>;

export const initiativeListResponseSchema = z.object({
  mission: z.string(),
  initiatives: z.array(initiativeSchema),
  unalignedProjectIds: z.array(z.string()),
});
export type InitiativeListResponse = z.infer<typeof initiativeListResponseSchema>;

const initiativeFields = {
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000),
  status: initiativeStatusSchema,
  targetDate: z.iso.date().nullable(),
  ownerTeammateId: z.string().min(1).nullable(),
  projectIds: z.array(z.string().min(1)).max(50),
};

export const createInitiativeSchema = z.object({
  ...initiativeFields,
  description: initiativeFields.description.default(""),
  status: initiativeFields.status.default("active"),
  targetDate: initiativeFields.targetDate.default(null),
  ownerTeammateId: initiativeFields.ownerTeammateId.default(null),
  projectIds: initiativeFields.projectIds.default([]),
});
export type CreateInitiativeInput = z.infer<typeof createInitiativeSchema>;

export const updateInitiativeSchema = z
  .object(initiativeFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, { error: "Change at least one field" });
export type UpdateInitiativeInput = z.infer<typeof updateInitiativeSchema>;

export const setupPlanTeammateSchema = z.object({
  key: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(80),
  roleSlug: z.string().min(1).nullable().default(null),
  jobDescription: z.string().trim().max(4000).nullable().default(null),
  reportsTo: z.string().trim().min(1).max(40).nullable().default(null),
  heartbeatMinutes: z
    .number()
    .int()
    .min(WORK_HEARTBEAT_MIN_MINUTES)
    .max(WORK_HEARTBEAT_MAX_MINUTES)
    .nullable()
    .default(null),
  monthlyCreditCapMicros: z.number().int().positive().nullable().default(null),
  projects: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
});

export const setupPlanProjectSchema = z.object({
  key: z.string().trim().min(1).max(40),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).default(""),
  starterId: z.string().min(1).nullable().default(null),
  taskPrefix: z
    .string()
    .trim()
    .regex(/^[A-Z]{2,5}$/),
  initiative: z.string().trim().min(1).max(40).nullable().default(null),
  standup: standupSettingsSchema.nullable().default(null),
});

export const setupPlanTaskSchema = z.object({
  project: z.string().trim().min(1).max(40),
  objective: z.string().trim().min(1).max(2000),
  owner: z.string().trim().min(1).max(40).nullable().default(null),
  priority: projectTaskPrioritySchema.default("medium"),
});

export const SETUP_PLAN_CONNECTOR_ACCESS = ["read", "write"] as const;

export const setupPlanConnectorSchema = z.object({
  provider: recipeConnectorProviderSchema,
  access: z.enum(SETUP_PLAN_CONNECTOR_ACCESS).default("read"),
  projects: z.array(z.string().trim().min(1).max(40)).min(1).max(8),
  reason: z.string().trim().max(300).default(""),
});
export type SetupPlanConnector = z.infer<typeof setupPlanConnectorSchema>;

export const setupPlanSuggestionSchema = z.object({
  provider: recipeConnectorProviderSchema,
  reason: z.string().trim().min(1).max(300),
});
export type SetupPlanSuggestion = z.infer<typeof setupPlanSuggestionSchema>;

export const setupPlanSchema = z.object({
  mission: z.string().trim().min(1).max(1000),
  monthlyCreditCapMicros: z.number().int().positive().nullable().default(null),
  initiatives: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(40),
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(2000).default(""),
      }),
    )
    .max(8)
    .default([]),
  projects: z.array(setupPlanProjectSchema).min(1).max(8),
  teammates: z.array(setupPlanTeammateSchema).max(12).default([]),
  tasks: z.array(setupPlanTaskSchema).max(30).default([]),
  connectors: z.array(setupPlanConnectorSchema).max(20).default([]),
  suggestions: z.array(setupPlanSuggestionSchema).max(10).default([]),
});
export type SetupPlan = z.infer<typeof setupPlanSchema>;

export const setupPlanCreatedSchema = z.object({
  projectIds: z.array(z.string()),
  teammateIds: z.array(z.string()),
  initiativeIds: z.array(z.string()),
  taskIds: z.array(z.string()),
});
export type SetupPlanCreated = z.infer<typeof setupPlanCreatedSchema>;

export const setupPlanStateSchema = z.object({
  revision: z.number().int().positive(),
  plan: setupPlanSchema,
  appliedAt: z.string().nullable(),
  created: setupPlanCreatedSchema.nullable(),
  failure: z
    .object({ at: z.string(), revision: z.number().int().positive(), message: z.string() })
    .nullable()
    .default(null),
});
export type SetupPlanState = z.infer<typeof setupPlanStateSchema>;

export const startOnboardingSchema = z.object({
  name: z.string().trim().min(2).max(80),
  mission: z.string().trim().min(1).max(1000),
  sources: z.array(z.url()).max(10).default([]),
  monthlyCreditCapMicros: z.number().int().positive().nullable().default(null),
  colour: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#E8643C"),
});
export type StartOnboardingInput = z.infer<typeof startOnboardingSchema>;

export const onboardingStateSchema = z.object({
  workspaceId: z.string(),
  projectId: z.string(),
  setupTaskId: z.string(),
  leadTeammateId: z.string(),
  setup: setupPlanStateSchema.nullable(),
});
export type OnboardingState = z.infer<typeof onboardingStateSchema>;

export const updateSetupPlanSchema = z.object({
  plan: setupPlanSchema,
  expectedRevision: z.number().int().positive().nullable(),
});

export const approveSetupPlanSchema = z.object({ revision: z.number().int().positive() });

export const WORK_INBOX_KINDS = [
  "hire",
  "budget",
  "standup",
  "escalation",
  "setup",
  "paused",
  "waiting",
] as const;
export const workInboxKindSchema = z.enum(WORK_INBOX_KINDS);
export type WorkInboxKind = z.infer<typeof workInboxKindSchema>;

export const workInboxItemSchema = z.object({
  id: z.string(),
  kind: workInboxKindSchema,
  workspaceId: z.string(),
  projectId: z.string().nullable(),
  taskId: z.string().nullable(),
  teammateId: z.string().nullable(),
  title: z.string(),
  detail: z.string().nullable(),
  dueAt: z.string().nullable().default(null),
  since: z.string(),
  deepLink: z.string(),
});
export type WorkInboxItem = z.infer<typeof workInboxItemSchema>;

export const workInboxResponseSchema = listSchema(workInboxItemSchema);
export type WorkInboxResponse = z.infer<typeof workInboxResponseSchema>;

export const workTaskListResponseSchema = z.object({
  tasks: z.array(projectTaskSchema),
});
export type WorkTaskListResponse = z.infer<typeof workTaskListResponseSchema>;

export const workTaskQuerySchema = z.object({
  owner_teammate_id: z.string().min(1).optional(),
  include_done: z.coerce.boolean().optional(),
});

export const workSpendRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  creditMicros: z.number().nonnegative(),
  costMicros: z.number().nonnegative(),
  runCount: z.number().int().nonnegative(),
  capCreditMicros: z.number().int().positive().nullable(),
});
export type WorkSpendRow = z.infer<typeof workSpendRowSchema>;

export const workCostsResponseSchema = z.object({
  period: z.string(),
  totalCreditMicros: z.number().nonnegative(),
  capCreditMicros: z.number().int().positive().nullable(),
  teammates: z.array(workSpendRowSchema),
  projects: z.array(workSpendRowSchema),
  initiatives: z.array(workSpendRowSchema),
  tasks: z.array(workSpendRowSchema),
});
export type WorkCostsResponse = z.infer<typeof workCostsResponseSchema>;

export const workRailBeatSchema = z.object({
  at: z.string(),
  kind: z.enum(["ran", "blocked", "running", "scheduled"]),
  trigger: z.string(),
  label: z.string().nullable(),
  runId: z.string().nullable(),
  taskId: z.string().nullable(),
  projectId: z.string().nullable(),
});
export type WorkRailBeat = z.infer<typeof workRailBeatSchema>;

export const workRailSchema = z.object({
  teammateId: z.string(),
  beats: z.array(workRailBeatSchema),
});

export const workRailsResponseSchema = z.object({
  from: z.string(),
  to: z.string(),
  rails: z.array(workRailSchema),
});
export type WorkRailsResponse = z.infer<typeof workRailsResponseSchema>;

export const workCostsQuerySchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

export const workRailsQuerySchema = z.object({
  hours: z.coerce.number().int().min(1).max(168).default(24),
});

export const workAssignSchema = z.object({ owner: workActorSchema });
