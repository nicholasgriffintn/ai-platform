import z from "zod/v4";

import { chatRunIdSchema } from "./chat-runs.js";

export const DELEGATION_MAX_DEPTH = 1 as const;
export const DELEGATION_MAX_FAN_OUT = 3 as const;
export const DELEGATION_MAX_CREDIT_SHARE = 0.25 as const;
export const DELEGATION_RUN_TASK_TYPE = "delegation_run" as const;
export const DELEGATION_WAKE_TASK_TYPE = "delegation_wake" as const;
export const DELEGATION_MESSAGE_TASK_TYPE = "delegation_message" as const;

export function resolveDelegationCreditCeiling(remainingCreditMicros: number): number {
  return Math.max(0, Math.floor(remainingCreditMicros * DELEGATION_MAX_CREDIT_SHARE));
}

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
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});
export type Delegation = z.infer<typeof delegationSchema>;

export const conversationHandleSchema = z
  .object({
    id: z.string().min(1),
    conversationId: z.string().min(1),
    grantedTo: z.object({ kind: z.literal("delegation"), delegationId: z.string().min(1) }),
    grantedBy: z.enum(["spawn", "user"]),
    grantedAt: z.string(),
    expiresAt: z.string().nullable(),
    revokedAt: z.string().nullable(),
  })
  .strict();
export type ConversationHandle = z.infer<typeof conversationHandleSchema>;

export const conversationHandleParamsSchema = z.object({
  handleId: z.string().min(1),
});

export const conversationHandleGrantSchema = z
  .object({
    conversationId: z.string().min(1),
    delegationId: z.string().min(1),
    expiresAt: z.string().nullable().optional(),
  })
  .strict();

export const conversationHandleListResponseSchema = z.object({
  handles: z.array(conversationHandleSchema),
});
export type ConversationHandleListResponse = z.infer<typeof conversationHandleListResponseSchema>;

export const delegationListResponseSchema = z.object({
  delegations: z.array(delegationSchema),
  canControl: z.boolean().optional(),
});
export type DelegationListResponse = z.infer<typeof delegationListResponseSchema>;

export const DELEGATION_RUN_EVENT_TYPES = [
  "delegation.created",
  "delegation.status_changed",
  "delegation.settled",
] as const;
export const delegationRunEventTypeSchema = z.enum(DELEGATION_RUN_EVENT_TYPES);
export type DelegationRunEventType = z.infer<typeof delegationRunEventTypeSchema>;

export const delegationRunTaskDataSchema = z.object({
  delegationId: z.string().min(1),
  projectId: z.string().min(1).nullable(),
  enabledTools: z.array(z.string()),
});
export type DelegationRunTaskData = z.infer<typeof delegationRunTaskDataSchema>;

export const delegationWakeTaskDataSchema = z.object({
  parentConversationId: z.string().min(1),
  parentRunId: chatRunIdSchema,
});
export type DelegationWakeTaskData = z.infer<typeof delegationWakeTaskDataSchema>;

export const delegationMessageTaskDataSchema = z.object({
  delegationId: z.string().min(1),
  message: z.string().min(1).max(20_000),
});
export type DelegationMessageTaskData = z.infer<typeof delegationMessageTaskDataSchema>;
