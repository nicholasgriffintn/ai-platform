import z from "zod/v4";

import { chatRunIdSchema } from "./chat-runs.js";
import { outputStatusSchema } from "./outputs.js";
import { creditMicrosFromCredits } from "./pricing/constants.js";
import { userQuestionSchema } from "./user-questions.js";

export const DELEGATION_MAX_DEPTH = 1 as const;
export const DELEGATION_MAX_FAN_OUT = 3 as const;
export const DELEGATION_MAX_CREDIT_SHARE = 0.25 as const;
export const DELEGATION_DEFAULT_MAX_CREDIT_MICROS = creditMicrosFromCredits(25);
export const DELEGATION_RUN_TASK_TYPE = "delegation_run" as const;
export const DELEGATION_WAKE_TASK_TYPE = "delegation_wake" as const;
export const DELEGATION_MESSAGE_TASK_TYPE = "delegation_message" as const;
export const DELEGATION_EXPIRY_TASK_TYPE = "delegation_expiry" as const;

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
  "awaiting_takeover",
  "done",
  "failed",
  "cancelled",
  "expired",
]);
export type DelegationState = z.infer<typeof delegationStateSchema>;

export const LIVE_DELEGATION_STATES: readonly DelegationState[] = [
  "queued",
  "running",
  "awaiting_input",
  "awaiting_approval",
  "awaiting_takeover",
];

export function isLiveDelegationState(state: DelegationState): boolean {
  return LIVE_DELEGATION_STATES.includes(state);
}

export const delegationBudgetSchema = z.object({
  maxCreditMicros: z.number().int().positive(),
  maxSteps: z.number().int().positive(),
  deadline: z.string().min(1),
});
export type DelegationBudget = z.infer<typeof delegationBudgetSchema>;

export const delegationResultSchema = z.object({
  summary: z.string(),
  outputIds: z.array(z.string()),
  finalMessageId: z.string().min(1).nullable().optional(),
  citations: z.array(z.string().min(1)).optional(),
  outstandingQuestions: z.array(userQuestionSchema).optional(),
});
export type DelegationResult = z.infer<typeof delegationResultSchema>;

export const delegationMemoryBindingSchema = z.object({
  documentId: z.string().min(1),
  access: z.enum(["read", "read-write"]),
});
export type DelegationMemoryBinding = z.infer<typeof delegationMemoryBindingSchema>;

export const delegationContinuationSchema = z
  .object({
    mode: z.enum(["new", "resume", "fresh"]),
    strategy: z.enum(["new", "conversation_history", "brief"]),
    predecessorDelegationId: z.string().min(1).nullable(),
    bindingConversationId: z.string().min(1).nullable(),
  })
  .strict();
export type DelegationContinuation = z.infer<typeof delegationContinuationSchema>;

export const delegationTeammateReferenceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  avatarUrl: z.string().nullable(),
});
export type DelegationTeammateReference = z.infer<typeof delegationTeammateReferenceSchema>;

export const delegationOutputReferenceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: z.string().min(1),
  status: outputStatusSchema,
});
export type DelegationOutputReference = z.infer<typeof delegationOutputReferenceSchema>;

export const delegationContextSchema = z.object({
  delegationId: z.string().min(1),
  depth: z.number().int().nonnegative(),
  rootConversationId: z.string().min(1),
  memoryBindings: z.array(delegationMemoryBindingSchema).default([]),
  continuation: delegationContinuationSchema.optional(),
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
  memoryBindings: z.array(delegationMemoryBindingSchema).default([]),
  predecessorDelegationId: z.string().min(1).nullable().optional(),
  continuationMode: z.enum(["new", "resume", "fresh"]).default("new"),
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

export const conversationHandleListResponseSchema = z.object({
  handles: z.array(conversationHandleSchema),
});
export type ConversationHandleListResponse = z.infer<typeof conversationHandleListResponseSchema>;

export const delegationListResponseSchema = z.object({
  delegations: z.array(delegationSchema),
  canControl: z.boolean().optional(),
  teammates: z.array(delegationTeammateReferenceSchema).optional(),
  outputs: z.array(delegationOutputReferenceSchema).optional(),
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

export const delegationExpiryTaskDataSchema = z.object({
  delegationId: z.string().min(1),
});
export type DelegationExpiryTaskData = z.infer<typeof delegationExpiryTaskDataSchema>;
