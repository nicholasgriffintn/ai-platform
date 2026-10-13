import z from "zod/v4";

import {
  chatCompletionMessageSchema,
  chatCompletionsRequestFieldsSchema,
} from "./chat-completions.js";

export const MAX_QUEUED_CHAT_MESSAGES = 10;

export const queuedChatRequestSchema = chatCompletionsRequestFieldsSchema
  .omit({
    messages: true,
    command_id: true,
    run_id: true,
    stream: true,
    store: true,
    completion_id: true,
    trigger: true,
    delegation_context: true,
    durable_execution: true,
  })
  .strict();

export type QueuedChatRequest = z.infer<typeof queuedChatRequestSchema>;

export const queuedChatUserMessageSchema = chatCompletionMessageSchema.refine(
  (message) => message.role === "user",
  { message: "Only a user message can be queued", path: ["role"] },
);

export const enqueueChatMessageRequestSchema = z
  .object({
    message: queuedChatUserMessageSchema,
    request: queuedChatRequestSchema.default({}),
  })
  .strict();

export type EnqueueChatMessageRequest = z.infer<typeof enqueueChatMessageRequestSchema>;

export const queuedChatMessageSchema = z.object({
  id: z.string().min(1),
  conversationId: z.string().min(1),
  preview: z.string(),
  attachmentCount: z.number().int().nonnegative(),
  createdAt: z.string(),
});

export type QueuedChatMessage = z.infer<typeof queuedChatMessageSchema>;

export const queuedChatMessageParamsSchema = z.object({
  completion_id: z.string().min(1),
});

export const queuedChatMessageItemParamsSchema = queuedChatMessageParamsSchema.extend({
  queued_id: z.string().min(1),
});

export const queuedChatMessagesResponseSchema = z.object({
  messages: z.array(queuedChatMessageSchema),
});

export const queuedChatTaskDataSchema = z.object({
  conversationId: z.string().min(1),
  message: queuedChatUserMessageSchema,
  request: queuedChatRequestSchema,
});

export type QueuedChatTaskData = z.infer<typeof queuedChatTaskDataSchema>;
