import z from "zod/v4";

import { chatContextSnapshotSchema } from "./chat-context";
import { chatRetrySnapshotSchema } from "./chat-retries";
import { normaliseCompactionStatusMessage } from "./compaction-status";
import { messagePartsSchema } from "./message-parts";
import { messageRoleSchema } from "./shared";
import { chatRunUsageSchema } from "./usage";

export const CHAT_RUN_PROTOCOL_VERSION = 1 as const;
export const CHAT_RUN_EVENT_PROTOCOL_VERSION = 1 as const;
export const CHAT_RUN_EVENT_RETENTION_LIMIT = 500 as const;

export const chatRunStatusSchema = z.enum([
  "accepted",
  "running",
  "awaiting_input",
  "awaiting_approval",
  "cancelling",
  "succeeded",
  "failed",
  "cancelled",
  "interrupted",
]);

export type ChatRunStatus = z.infer<typeof chatRunStatusSchema>;

export const TERMINAL_CHAT_RUN_STATUSES: readonly ChatRunStatus[] = [
  "succeeded",
  "failed",
  "cancelled",
  "interrupted",
];

const CHAT_RUN_TRANSITIONS: Record<ChatRunStatus, readonly ChatRunStatus[]> = {
  accepted: ["running", "cancelling", "failed", "cancelled", "interrupted"],
  running: [
    "awaiting_input",
    "awaiting_approval",
    "cancelling",
    "succeeded",
    "failed",
    "cancelled",
    "interrupted",
  ],
  awaiting_input: ["running", "cancelling", "failed", "cancelled", "interrupted"],
  awaiting_approval: ["running", "cancelling", "failed", "cancelled", "interrupted"],
  cancelling: ["cancelled", "failed", "interrupted"],
  succeeded: [],
  failed: [],
  cancelled: [],
  interrupted: [],
};

export function isTerminalChatRunStatus(status: ChatRunStatus): boolean {
  return TERMINAL_CHAT_RUN_STATUSES.includes(status);
}

export function canTransitionChatRun(from: ChatRunStatus, to: ChatRunStatus): boolean {
  return from === to || CHAT_RUN_TRANSITIONS[from].includes(to);
}

export const chatRunCommandIdSchema = z.string().trim().min(1).max(200);
export const chatRunIdSchema = z.string().trim().min(1).max(200);

export const chatRunCommandKindSchema = z.enum(["turn", "interaction_response", "cancel"]);
export type ChatRunCommandKind = z.infer<typeof chatRunCommandKindSchema>;

export const chatRunSchema = z.object({
  protocolVersion: z.literal(CHAT_RUN_PROTOCOL_VERSION),
  id: chatRunIdSchema,
  conversationId: z.string().min(1),
  projectId: z.string().min(1).nullable(),
  projectTaskId: z.string().min(1).nullable(),
  stageId: z.string().min(1).nullable().optional(),
  initiatorUserId: z.number().int().positive(),
  status: chatRunStatusSchema,
  attempt: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  cancellationRequestedAt: z.string().nullable().optional(),
  terminalReason: z.string().nullable(),
  lastMessageId: z.string().min(1).nullable(),
  context: chatContextSnapshotSchema.nullable().optional(),
  retry: chatRetrySnapshotSchema.nullable().optional(),
  usage: chatRunUsageSchema.optional(),
});

export type ChatRun = z.infer<typeof chatRunSchema>;

export const chatRunCommandReceiptSchema = z.object({
  protocolVersion: z.literal(CHAT_RUN_PROTOCOL_VERSION),
  commandId: chatRunCommandIdSchema,
  run: chatRunSchema,
  kind: chatRunCommandKindSchema,
  acceptedAt: z.string(),
  duplicate: z.boolean(),
});

export type ChatRunCommandReceipt = z.infer<typeof chatRunCommandReceiptSchema>;

export const chatRunCommandReceiptResponseSchema = z.object({
  run: chatRunCommandReceiptSchema,
});
export type ChatRunCommandReceiptResponse = z.infer<typeof chatRunCommandReceiptResponseSchema>;

export const chatRunStatusResponseSchema = z.object({ run: chatRunSchema });
export type ChatRunStatusResponse = z.infer<typeof chatRunStatusResponseSchema>;

export const chatRunParamsSchema = z.object({ run_id: chatRunIdSchema });
export const chatRunCommandParamsSchema = z.object({ command_id: chatRunCommandIdSchema });

export const cancelChatRunRequestSchema = z.object({
  command_id: chatRunCommandIdSchema,
  expected_attempt: z.number().int().positive(),
});
export type CancelChatRunRequest = z.infer<typeof cancelChatRunRequestSchema>;

export const storedChatMessageResponseSchema = z
  .object({
    id: z.string().optional(),
    role: messageRoleSchema,
    name: z.string().nullable().optional(),
    tool_calls: z.array(z.unknown()).nullable().optional(),
    parts: messagePartsSchema.nullable().optional(),
    content: z
      .union([z.string(), z.array(z.unknown()), z.record(z.string(), z.unknown())])
      .nullable()
      .optional(),
    status: z.string().nullable().optional(),
    data: z.record(z.string(), z.any()).nullable().optional(),
    completion_id: z.string().nullable().optional(),
    run_id: z.string().nullable().optional(),
    created: z.number().optional(),
    model: z.string().nullable().optional(),
    provider: z.string().nullable().optional(),
    log_id: z.string().nullable().optional(),
    reasoning: z
      .object({ collapsed: z.boolean().optional(), content: z.string() })
      .nullable()
      .optional(),
    citations: z.array(z.string()).nullable().optional(),
    app: z.string().nullable().optional(),
    mode: z.string().nullable().optional(),
    parent_message_id: z.string().nullable().optional(),
    tool_call_id: z.string().nullable().optional(),
    tool_call_arguments: z.any().optional(),
    timestamp: z.number().optional(),
    platform: z.string().nullable().optional(),
    usage: z.record(z.string(), z.any()).nullable().optional(),
  })
  .passthrough()
  .superRefine((message, ctx) => {
    const hasContent = message.content !== undefined && message.content !== null;
    const hasParts = Array.isArray(message.parts) && message.parts.length > 0;
    const hasToolCalls = Array.isArray(message.tool_calls) && message.tool_calls.length > 0;

    if (!hasContent && !hasParts && !hasToolCalls) {
      ctx.addIssue({
        code: "custom",
        path: ["content"],
        message: "Stored message responses must include content, parts, or tool_calls",
      });
    }

    if (message.role === "compaction" && !normaliseCompactionStatusMessage(message)) {
      ctx.addIssue({
        code: "custom",
        path: ["parts"],
        message: "Compaction messages must include a valid compaction part",
      });
    }
  });

export const chatRunRecoveryResponseSchema = z.object({
  run: chatRunSchema,
  messages: z.array(storedChatMessageResponseSchema),
});
export type ChatRunRecoveryResponse = z.infer<typeof chatRunRecoveryResponseSchema>;

export const chatRunEventSchema = z.object({
  protocolVersion: z.number().int().positive(),
  id: z.string().min(1),
  runId: chatRunIdSchema,
  sequence: z.number().int().positive(),
  attempt: z.number().int().positive(),
  type: z.string().min(1),
  occurredAt: z.string(),
  data: z.record(z.string(), z.unknown()),
});
export type ChatRunEvent = z.infer<typeof chatRunEventSchema>;

export const chatRunSnapshotResponseSchema = chatRunRecoveryResponseSchema.extend({
  protocolVersion: z.literal(CHAT_RUN_EVENT_PROTOCOL_VERSION),
  cursor: z.number().int().nonnegative(),
});
export type ChatRunSnapshotResponse = z.infer<typeof chatRunSnapshotResponseSchema>;

export const chatRunReplayQuerySchema = z.object({
  after: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});
export type ChatRunReplayQuery = z.infer<typeof chatRunReplayQuerySchema>;

export const chatRunReplayResponseSchema = z.object({
  protocolVersion: z.number().int().positive(),
  runId: chatRunIdSchema,
  fromCursor: z.number().int().nonnegative(),
  nextCursor: z.number().int().nonnegative(),
  resetRequired: z.boolean(),
  events: z.array(chatRunEventSchema),
  snapshot: chatRunSnapshotResponseSchema.nullable(),
});
export type ChatRunReplayResponse = z.infer<typeof chatRunReplayResponseSchema>;
