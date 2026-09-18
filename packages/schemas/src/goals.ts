import z from "zod/v4";

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

export { goalMarkerEventNames as goalMarkerEvents } from "./message-part-utils.js";
export type { GoalMarkerEventName as GoalMarkerEvent } from "./message-part-utils.js";
