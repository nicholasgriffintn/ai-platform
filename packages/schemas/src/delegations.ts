import z from "zod/v4";

import { chatRunIdSchema } from "./chat-runs.js";

export const DELEGATION_MAX_DEPTH = 1 as const;
export const DELEGATION_MAX_FAN_OUT = 3 as const;
export const DELEGATION_DEFAULT_TOKEN_BUDGET = 400_000 as const;

export const delegationWaitForSchema = z.enum(["all", "any", "none"]);
export type DelegationWaitFor = z.infer<typeof delegationWaitForSchema>;

export const delegationStateSchema = z.enum([
  "queued",
  "running",
  "awaiting_input",
  "awaiting_approval",
  "done",
  "failed",
  "cancelled",
  "expired",
]);
export type DelegationState = z.infer<typeof delegationStateSchema>;

export const delegationBudgetSchema = z.object({
  maxCreditMicros: z.number().int().positive(),
  maxSteps: z.number().int().positive(),
  deadline: z.string().min(1),
});
export type DelegationBudget = z.infer<typeof delegationBudgetSchema>;

export const delegationResultSchema = z.object({
  summary: z.string(),
  outputIds: z.array(z.string()),
});
export type DelegationResult = z.infer<typeof delegationResultSchema>;

export const delegationContextSchema = z.object({
  delegationId: z.string().min(1),
  depth: z.number().int().nonnegative(),
  rootConversationId: z.string().min(1),
});
export type DelegationContext = z.infer<typeof delegationContextSchema>;

export const delegationSchema = z.object({
  id: z.string().min(1),
  parentConversationId: z.string().min(1),
  childConversationId: z.string().min(1),
  parentRunId: chatRunIdSchema,
  depth: z.number().int().min(1).max(DELEGATION_MAX_DEPTH),
  teammateId: z.string().min(1),
  goal: z.string().min(1).max(2000),
  waitFor: delegationWaitForSchema,
  budget: delegationBudgetSchema,
  state: delegationStateSchema,
  result: delegationResultSchema.nullable(),
});
export type Delegation = z.infer<typeof delegationSchema>;

export const DELEGATION_RUN_EVENT_TYPES = [
  "delegation.created",
  "delegation.status_changed",
  "delegation.settled",
] as const;
export const delegationRunEventTypeSchema = z.enum(DELEGATION_RUN_EVENT_TYPES);
export type DelegationRunEventType = z.infer<typeof delegationRunEventTypeSchema>;
