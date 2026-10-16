import z from "zod/v4";

import { chatRequestModeSchema } from "../agent-modes.js";
import { recipeChatRequestOptionsSchema } from "../apps.js";
import { chatContextSnapshotSchema } from "../chat-context.js";
import { chatRetrySnapshotSchema } from "../chat-retries.js";
import {
  canTransitionChatRun,
  chatRunCommandIdSchema,
  chatRunCommandKindSchema,
  chatRunIdSchema,
  chatRunInteractionKindSchema,
  chatRunTriggerSchema,
  type ChatRun,
  type ChatRunCommandReceipt,
  type ChatRunStatus,
} from "../chat-runs.js";
import { conversationTypeSchema } from "../conversation-type.js";
import {
  chatCompactionModeSchema,
  chatResponseFormatSchema,
  connectorChatRequestOptionsSchema,
} from "../engine-request.js";
import { modelTierSchema } from "../model-lineup.js";
import { polyUiContextSchema } from "../poly.js";
import { permissionModeSchema } from "../providers.js";
import { reasoningEffortSchema, reasoningSettingsSchema } from "../reasoning.js";
import { runProvenanceSchema } from "../run-provenance.js";
import { sandboxRequestOptionsSchema } from "../sandbox.js";
import { chatRunUsageSchema } from "../usage.js";
import { itemSchema, itemsSchema, storedItemSchema } from "./items.js";
import { listQuerySchema, listSchema } from "./list.js";
import { responseToolChoiceSchema, responseToolsSchema } from "./tools.js";

const recordSchema = z.record(z.string(), z.unknown());

export const RESPONSE_PROTOCOL_VERSION = 1 as const;

export const responseIdSchema = chatRunIdSchema;
export const responseIdempotencyKeySchema = chatRunCommandIdSchema;

export const responseStatusSchema = z.enum([
  "queued",
  "in_progress",
  "awaiting_input",
  "awaiting_approval",
  "awaiting_takeover",
  "cancelling",
  "completed",
  "failed",
  "cancelled",
  "incomplete",
]);

export type ResponseStatus = z.infer<typeof responseStatusSchema>;

const RUN_STATUS_TO_RESPONSE_STATUS: Record<ChatRunStatus, ResponseStatus> = {
  accepted: "queued",
  running: "in_progress",
  awaiting_input: "awaiting_input",
  awaiting_approval: "awaiting_approval",
  awaiting_takeover: "awaiting_takeover",
  cancelling: "cancelling",
  succeeded: "completed",
  failed: "failed",
  cancelled: "cancelled",
  interrupted: "incomplete",
};

const RESPONSE_STATUS_TO_RUN_STATUS: Record<ResponseStatus, ChatRunStatus> = {
  queued: "accepted",
  in_progress: "running",
  awaiting_input: "awaiting_input",
  awaiting_approval: "awaiting_approval",
  awaiting_takeover: "awaiting_takeover",
  cancelling: "cancelling",
  completed: "succeeded",
  failed: "failed",
  cancelled: "cancelled",
  incomplete: "interrupted",
};

export function responseStatusFromRunStatus(status: ChatRunStatus): ResponseStatus {
  return RUN_STATUS_TO_RESPONSE_STATUS[status];
}

export function runStatusFromResponseStatus(status: ResponseStatus): ChatRunStatus {
  return RESPONSE_STATUS_TO_RUN_STATUS[status];
}

export const TERMINAL_RESPONSE_STATUSES: readonly ResponseStatus[] = [
  "completed",
  "failed",
  "cancelled",
  "incomplete",
];

export const WAITING_RESPONSE_STATUSES: readonly ResponseStatus[] = [
  "awaiting_input",
  "awaiting_approval",
  "awaiting_takeover",
];

export function isTerminalResponseStatus(status: ResponseStatus): boolean {
  return TERMINAL_RESPONSE_STATUSES.includes(status);
}

export function isWaitingResponseStatus(status: ResponseStatus): boolean {
  return WAITING_RESPONSE_STATUSES.includes(status);
}

export function canTransitionResponse(from: ResponseStatus, to: ResponseStatus): boolean {
  return canTransitionChatRun(runStatusFromResponseStatus(from), runStatusFromResponseStatus(to));
}

export const responseTriggerSchema = chatRunTriggerSchema;
export type ResponseTrigger = z.infer<typeof responseTriggerSchema>;

export const responseReceiptSchema = z.object({
  idempotency_key: responseIdempotencyKeySchema,
  kind: chatRunCommandKindSchema,
  accepted_at: z.string(),
  duplicate: z.boolean(),
});

export type ResponseReceipt = z.infer<typeof responseReceiptSchema>;

export const responseSchema = z.object({
  object: z.literal("response"),
  id: responseIdSchema,
  conversation_id: z.string().min(1),
  status: responseStatusSchema,
  waiting_on: chatRunInteractionKindSchema.nullable(),
  attempt: z.number().int().positive(),
  trigger: responseTriggerSchema,
  initiator_user_id: z.number().int().positive().nullable(),
  project_id: z.string().min(1).nullable(),
  project_task_id: z.string().min(1).nullable(),
  stage_id: z.string().min(1).nullable().optional(),
  teammate_context_id: z.string().min(1).nullable().optional(),
  computer_id: z.string().min(1).nullable().optional(),
  resolved_configuration: recordSchema.nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  cancellation_requested_at: z.string().nullable().optional(),
  terminal_reason: z.string().nullable(),
  last_item_id: z.string().min(1).nullable(),
  context: chatContextSnapshotSchema.nullable().optional(),
  retry: chatRetrySnapshotSchema.nullable().optional(),
  provenance: runProvenanceSchema.nullable().optional(),
  usage: chatRunUsageSchema.optional(),
  receipt: responseReceiptSchema.optional(),
  output: z.array(storedItemSchema).optional(),
});

export type PlatformResponse = z.infer<typeof responseSchema>;

export function toResponse(
  run: ChatRun,
  extras: { receipt?: ChatRunCommandReceipt; output?: PlatformResponse["output"] } = {},
): PlatformResponse {
  return {
    object: "response",
    id: run.id,
    conversation_id: run.conversationId,
    status: responseStatusFromRunStatus(run.status),
    waiting_on: run.interactionKind ?? null,
    attempt: run.attempt,
    trigger: run.trigger,
    initiator_user_id: run.initiatorUserId,
    project_id: run.projectId,
    project_task_id: run.projectTaskId,
    stage_id: run.stageId ?? null,
    teammate_context_id: run.teammateContextId ?? null,
    computer_id: run.computerId ?? null,
    resolved_configuration: run.resolvedConfiguration ?? null,
    created_at: run.createdAt,
    updated_at: run.updatedAt,
    started_at: run.startedAt,
    completed_at: run.completedAt,
    cancellation_requested_at: run.cancellationRequestedAt ?? null,
    terminal_reason: run.terminalReason,
    last_item_id: run.lastMessageId,
    context: run.context ?? null,
    retry: run.retry ?? null,
    provenance: run.provenance ?? null,
    ...(run.usage ? { usage: run.usage } : {}),
    ...(extras.receipt
      ? {
          receipt: {
            idempotency_key: extras.receipt.commandId,
            kind: extras.receipt.kind,
            accepted_at: extras.receipt.acceptedAt,
            duplicate: extras.receipt.duplicate,
          },
        }
      : {}),
    ...(extras.output ? { output: extras.output } : {}),
  };
}

export const responseConversationSchema = z.union([
  z.string().min(1),
  z
    .object({
      id: z.string().min(1).optional(),
      type: conversationTypeSchema.optional(),
      project_id: z.string().min(1).optional(),
    })
    .strict(),
  z.null(),
]);

export type ResponseConversation = z.infer<typeof responseConversationSchema>;

export const responseAgentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("teammate"), id: z.string().min(1) }).strict(),
]);

export type ResponseAgent = z.infer<typeof responseAgentSchema>;

export const responseEnvironmentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hosted") }).strict(),
  z.object({ type: z.literal("browser") }).strict(),
  z.object({ type: z.literal("device") }).strict(),
  z.object({ type: z.literal("machine"), machine_id: z.string().min(1).optional() }).strict(),
  z
    .object({ type: z.literal("sandbox") })
    .extend(sandboxRequestOptionsSchema.omit({ enabled: true }).shape)
    .passthrough(),
]);

export type ResponseEnvironment = z.infer<typeof responseEnvironmentSchema>;

export const responseSamplingSchema = z
  .object({
    temperature: z.number().min(0).max(2).optional(),
    top_p: z.number().min(0).max(1).optional(),
    top_k: z.number().min(1).max(100).optional(),
    n: z.number().min(1).max(4).optional(),
    seed: z.number().optional(),
    stop: z.union([z.string(), z.array(z.string())]).optional(),
    max_output_tokens: z.number().optional(),
    presence_penalty: z.number().min(-2).max(2).optional(),
    frequency_penalty: z.number().min(-2).max(2).optional(),
    repetition_penalty: z.number().min(0).max(2).optional(),
    logit_bias: z.record(z.string(), z.number()).optional(),
    logprobs: z.boolean().optional(),
    top_logprobs: z.number().int().min(0).max(20).optional(),
  })
  .strict();

export const responseTextSettingsSchema = z
  .object({
    format: chatResponseFormatSchema.optional(),
    verbosity: z.enum(["low", "medium", "high", "caveman"]).optional(),
  })
  .strict();

export const responseBudgetSchema = z
  .object({
    steps: z.number().int().min(1).optional(),
    credits: z.number().optional(),
  })
  .strict();

export const responseClientSchema = z
  .object({
    platform: z.string().min(1).optional(),
    ui_context: polyUiContextSchema.optional(),
  })
  .strict();

export const responseOptionsSchema = z
  .object({
    source: z.string().optional(),
    recipe: recipeChatRequestOptionsSchema.optional(),
    connector: connectorChatRequestOptionsSchema.optional(),
    agent: z.object({ minToolCalls: z.number().int().min(0).optional() }).optional(),
  })
  .strict();

export const responseReasoningSchema = z.union([
  reasoningSettingsSchema,
  z.object({ effort: reasoningEffortSchema }).strict(),
]);

export const createResponseRequestSchema = z
  .object({
    conversation: responseConversationSchema.optional(),
    input: z.union([itemsSchema, z.string()]).optional(),
    instructions: z.string().optional(),
    model: z.string().min(1).optional(),
    models: z.array(z.string().min(1)).optional(),
    provider: z.string().min(1).optional(),
    model_tier: modelTierSchema.optional(),
    agent: responseAgentSchema.optional(),
    environment: responseEnvironmentSchema.optional(),
    tools: responseToolsSchema.optional(),
    tool_choice: responseToolChoiceSchema.optional(),
    parallel_tool_calls: z.boolean().optional(),
    permission_mode: permissionModeSchema.optional(),
    mode: chatRequestModeSchema.optional(),
    compaction: chatCompactionModeSchema.optional(),
    reasoning: responseReasoningSchema.optional(),
    sampling: responseSamplingSchema.optional(),
    text: responseTextSettingsSchema.optional(),
    budget: responseBudgetSchema.optional(),
    cache_ttl_seconds: z.number().min(0).optional(),
    service_tier: z.string().min(1).optional(),
    stream: z.boolean().optional(),
    store: z.boolean().optional(),
    background: z.boolean().optional(),
    include: z.array(z.enum(["reasoning.encrypted"])).optional(),
    idempotency_key: responseIdempotencyKeySchema.optional(),
    response_id: responseIdSchema.optional(),
    client: responseClientSchema.optional(),
    metadata: z.record(z.string(), z.string()).optional(),
    options: responseOptionsSchema.optional(),
  })
  .strict()
  .superRefine((request, ctx) => {
    if (request.model && request.models?.length) {
      ctx.addIssue({
        code: "custom",
        path: ["models"],
        message: "Provide either model or models, not both",
      });
    }

    const hasInput =
      typeof request.input === "string"
        ? request.input.trim().length > 0
        : (request.input?.length ?? 0) > 0;

    if (!hasInput && !request.response_id) {
      ctx.addIssue({
        code: "custom",
        path: ["input"],
        message: "input is required unless response_id resumes a waiting response",
      });
    }
  });

export type CreateResponseRequest = z.input<typeof createResponseRequestSchema>;
export type ParsedCreateResponseRequest = z.output<typeof createResponseRequestSchema>;

export const responseInputRequestSchema = z
  .object({
    input: itemsSchema.min(1),
    when: z.enum(["now", "after"]).optional(),
    idempotency_key: responseIdempotencyKeySchema.optional(),
    stream: z.boolean().optional(),
    client: responseClientSchema.optional(),
  })
  .strict();

export type ResponseInputRequest = z.infer<typeof responseInputRequestSchema>;

export const cancelResponseRequestSchema = z
  .object({
    expected_attempt: z.number().int().positive(),
    idempotency_key: responseIdempotencyKeySchema.optional(),
  })
  .strict();

export type CancelResponseRequest = z.infer<typeof cancelResponseRequestSchema>;

export const responseParamsSchema = z.object({ response_id: responseIdSchema });

export const RESPONSE_EVENT_TYPES = {
  created: "response.created",
  statusChanged: "response.status_changed",
  retryChanged: "response.retry_changed",
  effect: "response.effect",
} as const;

export const responseEventRecordSchema = z.object({
  id: z.string().min(1),
  response_id: responseIdSchema,
  sequence: z.number().int().positive(),
  attempt: z.number().int().positive(),
  type: z.string().min(1),
  occurred_at: z.string(),
  data: recordSchema,
});

export type ResponseEventRecord = z.infer<typeof responseEventRecordSchema>;

export const responseSnapshotSchema = responseSchema.extend({
  cursor: z.number().int().nonnegative(),
  output: z.array(storedItemSchema),
});

export type ResponseSnapshot = z.infer<typeof responseSnapshotSchema>;

export const responseReplayQuerySchema = z.object({
  after: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

export type ResponseReplayQuery = z.infer<typeof responseReplayQuerySchema>;

export const responseListSchema = listSchema(responseSchema);

export const responseReplayResponseSchema = listSchema(responseEventRecordSchema).extend({
  response_id: responseIdSchema,
  from_cursor: z.number().int().nonnegative(),
  next_cursor: z.number().int().nonnegative(),
  reset_required: z.boolean(),
  snapshot: responseSnapshotSchema.nullable(),
});

export const responseLookupQuerySchema = listQuerySchema.extend({
  idempotency_key: responseIdempotencyKeySchema,
});

export type ResponseReplayResponse = z.infer<typeof responseReplayResponseSchema>;

export const compactResponseRequestSchema = z
  .object({
    conversation: z.string().min(1),
  })
  .strict();

export type CompactResponseRequest = z.infer<typeof compactResponseRequestSchema>;

export const responseInputTokensRequestSchema = z.object({
  model: z.string().min(1),
  provider: z.string().optional(),
  input: z.union([itemsSchema, z.string()]),
  instructions: z.string().optional(),
});

export type ResponseInputTokensRequest = z.infer<typeof responseInputTokensRequestSchema>;

export const responseInputTokensResponseSchema = z.object({
  input_tokens: z.number(),
  model: z.string(),
});

export type ResponseInputTokensResponse = z.infer<typeof responseInputTokensResponseSchema>;

export const responseInputItemSchema = itemSchema;
