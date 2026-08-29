import z from "zod/v4";

export const GOAL_STALL_THRESHOLD = 2;

export const goalStatusSchema = z.enum([
  "active",
  "paused",
  "completed",
  "cleared",
  "blocked",
  "stalled",
  "limit_reached",
]);

export type GoalStatus = z.infer<typeof goalStatusSchema>;

export const TERMINAL_GOAL_STATUSES: readonly GoalStatus[] = [
  "completed",
  "cleared",
  "blocked",
  "stalled",
  "limit_reached",
];

export function isTerminalGoalStatus(status: GoalStatus): boolean {
  return TERMINAL_GOAL_STATUSES.includes(status);
}

export const goalSourceSchema = z.enum(["user", "model"]);
export type GoalSource = z.infer<typeof goalSourceSchema>;

export const goalSurfaceSchema = z.enum(["chat", "agent", "sandbox"]);
export type GoalSurface = z.infer<typeof goalSurfaceSchema>;

export const goalEvidenceStatusSchema = z.enum([
  "confirmed",
  "approximate",
  "supporting",
  "blocked",
]);
export type GoalEvidenceStatus = z.infer<typeof goalEvidenceStatusSchema>;

export const goalEvidenceEntrySchema = z.object({
  claim: z.string().min(1).describe("The part of the objective this entry speaks to."),
  route: z.string().min(1).describe("How it was established: what was run, read, or changed."),
  evidence_surface: z
    .string()
    .min(1)
    .describe("Where the evidence lives: a tool result, run id, file, or source."),
  status: goalEvidenceStatusSchema.describe("How strongly the evidence supports the claim."),
  remaining_uncertainty: z.string().optional().describe("What is still unproven about this claim."),
});

export type GoalEvidenceEntry = z.infer<typeof goalEvidenceEntrySchema>;

export const goalProgressEntrySchema = z.object({
  iteration: z.number().int().min(0),
  surface: goalSurfaceSchema,
  summary: z.string(),
  evidence: z.array(z.string()).default([]),
  next: z.string().optional(),
  steer: z.string().optional().describe("A user instruction that redirected the work."),
  at: z.string(),
});

export type GoalProgressEntry = z.infer<typeof goalProgressEntrySchema>;

export const goalOwnerSchema = z.union([
  z.object({ conversationId: z.string().min(1) }).strict(),
  z.object({ sandboxRunId: z.string().min(1) }).strict(),
]);

export type GoalOwner = z.infer<typeof goalOwnerSchema>;

export function isConversationOwner(owner: GoalOwner): owner is { conversationId: string } {
  return "conversationId" in owner;
}

export const goalSchema = z.object({
  id: z.string(),
  conversation_id: z.string().nullable(),
  sandbox_run_id: z.string().nullable(),
  user_id: z.number(),
  objective: z.string(),
  status: goalStatusSchema,
  source: goalSourceSchema,
  iteration_count: z.number().int().min(0),
  stall_streak: z.number().int().min(0),
  tokens_spent: z.number().int().min(0),
  progress: z.array(goalProgressEntrySchema),
  evidence: z.array(goalEvidenceEntrySchema).nullable(),
  stopped_reason: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  last_continued_at: z.string().nullable(),
});

export type Goal = z.infer<typeof goalSchema>;

export const setGoalRequestSchema = z.object({
  objective: z.string().trim().min(1).max(2000),
  project_id: z.string().min(1).optional(),
});

export const updateGoalRequestSchema = z.object({
  status: z.enum(["active", "paused", "cleared"]),
});

export const goalResponseSchema = z.object({
  goal: goalSchema.nullable(),
});

export const recordGoalIterationRequestSchema = z.object({
  summary: z.string().trim().max(4000),
  producedEvidence: z.boolean(),
  calledTool: z.boolean(),
  evidence: z.array(z.string().trim().min(1)).max(20).optional(),
  next: z.string().trim().max(2000).optional(),
});

export const recordGoalIterationResponseSchema = z.object({
  goal: goalSchema.nullable(),
  shouldContinue: z.boolean(),
  instruction: z.string().optional(),
});

export type RecordGoalIterationRequest = z.infer<typeof recordGoalIterationRequestSchema>;
export type RecordGoalIterationResponse = z.infer<typeof recordGoalIterationResponseSchema>;

export type SetGoalRequest = z.infer<typeof setGoalRequestSchema>;
export type UpdateGoalRequest = z.infer<typeof updateGoalRequestSchema>;
export type GoalResponse = z.infer<typeof goalResponseSchema>;

export interface GoalContinuationInput {
  goal: Pick<Goal, "status" | "stall_streak"> | null;
  lastTurn: {
    producedEvidence: boolean;
    calledTool: boolean;
    aborted: boolean;
    awaitingApproval: boolean;
  };
  usageLimitsExhausted: boolean;
  queuedInstructionCount: number;
  otherWorkInFlight: boolean;
}

export type GoalContinuationReason =
  | "continue"
  | "no-goal"
  | "not-active"
  | "aborted"
  | "awaiting-approval"
  | "queued-input"
  | "work-in-flight"
  | "usage-limits"
  | "stalled";

export interface GoalContinuationDecision {
  shouldContinue: boolean;
  reason: GoalContinuationReason;
  nextStallStreak: number;
}

/**
 * The single rule for whether a goal keeps working. Consumed by the client
 * dispatcher, the agent loop's finish gate and the sandbox coordinator, so the
 * behaviour cannot drift between them. Deliberately counts no turns: a goal
 * making progress runs as long as it needs to.
 */
export function evaluateGoalContinuation(input: GoalContinuationInput): GoalContinuationDecision {
  const currentStreak = input.goal?.stall_streak ?? 0;
  const madeProgress = input.lastTurn.producedEvidence || input.lastTurn.calledTool;
  const nextStallStreak = madeProgress ? 0 : currentStreak + 1;

  if (!input.goal) {
    return { shouldContinue: false, reason: "no-goal", nextStallStreak: 0 };
  }

  if (input.goal.status !== "active") {
    return { shouldContinue: false, reason: "not-active", nextStallStreak: currentStreak };
  }

  if (input.lastTurn.aborted) {
    return { shouldContinue: false, reason: "aborted", nextStallStreak: currentStreak };
  }

  if (input.lastTurn.awaitingApproval) {
    return { shouldContinue: false, reason: "awaiting-approval", nextStallStreak: currentStreak };
  }

  if (input.queuedInstructionCount > 0) {
    return { shouldContinue: false, reason: "queued-input", nextStallStreak: currentStreak };
  }

  if (input.otherWorkInFlight) {
    return { shouldContinue: false, reason: "work-in-flight", nextStallStreak: currentStreak };
  }

  if (input.usageLimitsExhausted) {
    return { shouldContinue: false, reason: "usage-limits", nextStallStreak };
  }

  if (nextStallStreak >= GOAL_STALL_THRESHOLD) {
    return { shouldContinue: false, reason: "stalled", nextStallStreak };
  }

  return { shouldContinue: true, reason: "continue", nextStallStreak };
}

export const goalStatusLabels: Record<GoalStatus, string> = {
  active: "Goal active",
  paused: "Goal paused",
  completed: "Goal completed",
  cleared: "Goal cleared",
  blocked: "Goal blocked",
  stalled: "Goal stopped making progress",
  limit_reached: "Goal stopped at your usage limit",
};

export { goalMarkerEventNames as goalMarkerEvents } from "./message-part-utils";
export type { GoalMarkerEventName as GoalMarkerEvent } from "./message-part-utils";
