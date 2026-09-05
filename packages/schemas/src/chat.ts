import z from "zod/v4";

import {
  chatRunCommandReceiptSchema,
  chatRunSchema,
  storedChatMessageResponseSchema,
} from "./chat-runs";
import { normaliseCompactionStatusMessage } from "./compaction-status";
import { messagePartsSchema } from "./message-parts";
import { messageSchema } from "./shared";
import { threadOperationSchema } from "./thread-operations";

export {
  chatCompletionMessageSchema,
  chatCompletionToolSchema,
  chatHostedToolSettingsSchema,
  chatMessageContentPartSchema,
  chatRequestOptionsSchema,
  chatRunCommandInputSchema,
  chatResponseFormatSchema,
  chatToolChoiceSchema,
  connectorApprovalIdSchema,
  modelRouterModeSchema,
  toolInteractionResolutionSchema,
  partialChatCompletionsJsonSchema,
  createChatCompletionsResponseSchema,
  createChatCompletionsJsonSchema,
  parseChatRequestOptions,
  readRecipeChatRequestOptions,
} from "./chat-completions";
export type {
  ChatCompletionRequestBody,
  ChatCompletionResponseBody,
  ChatHostedToolSettings,
  ChatRequestOptions,
  ModelRouterMode,
  ParsedChatCompletionRequestBody,
  ToolInteractionResolution,
} from "./chat-completions";

export const chatCompletionResponseSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  model: z.string(),
  choices: z.array(
    z.object({
      index: z.number(),
      message: messageSchema,
      finish_reason: z.string().nullable(),
    }),
  ),
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      total_tokens: z.number(),
    })
    .optional(),
  log_id: z.string().optional(),
  run: chatRunCommandReceiptSchema.optional(),
});

export const countTokensJsonSchema = z.object({
  model: z.string().meta({
    description: "The model to use for token counting.",
  }),
  provider: z.string().optional().meta({
    description: "The provider to use when the model name is shared by multiple providers.",
  }),
  messages: z.array(z.any()).meta({
    description: "The messages to count tokens for.",
  }),
  system_prompt: z.string().optional().meta({
    description: "The system prompt to include in token count.",
  }),
});

export const countTokensResponseSchema = z.object({
  inputTokens: z.number().meta({
    description: "The number of input tokens.",
  }),
  model: z.string().meta({
    description: "The model used for token counting.",
  }),
});

export const getChatCompletionParamsSchema = z.object({
  completion_id: z.string().meta({
    description: "The ID of the chat completion to retrieve.",
  }),
});

export const generateChatCompletionTitleParamsSchema = z.object({
  completion_id: z.string().meta({
    description: "The ID of the chat completion to retrieve.",
  }),
});

const titleCompactionMessageSchema = z.object({
  role: z.literal("compaction"),
  content: z.union([z.string(), z.array(z.unknown())]),
  parts: messagePartsSchema.optional(),
});

export const generateChatCompletionTitleJsonSchema = z.object({
  messages: z.array(z.union([messageSchema, titleCompactionMessageSchema])).optional(),
  store: z.boolean().optional(),
});

export const conversationArchiveFilterSchema = z.enum(["active", "archived", "all"]);

export const conversationSortBySchema = z.enum(["updated", "created", "title"]);

export const conversationActivityWindowSchema = z.enum(["all", "today", "week", "month"]);

export const conversationTypeSchema = z.enum(["chat", "task"]);

export type ConversationArchiveFilter = z.infer<typeof conversationArchiveFilterSchema>;
export type ConversationSortBy = z.infer<typeof conversationSortBySchema>;
export type ConversationActivityWindow = z.infer<typeof conversationActivityWindowSchema>;
export type ConversationType = z.infer<typeof conversationTypeSchema>;

export const bulkArchiveChatCompletionsJsonSchema = z.object({
  archived: z.boolean(),
  q: z.string().trim().max(200).optional(),
  updated_after: z.iso.datetime().optional(),
});

export const bulkArchiveChatCompletionsResponseSchema = z.object({
  success: z.boolean(),
  archived: z.number(),
});

export const updateChatCompletionParamsSchema = z.object({
  completion_id: z.string().meta({
    description: "The ID of the chat completion to retrieve.",
  }),
});

export const updateChatCompletionJsonSchema = z
  .object({
    title: z.string().optional(),
    archived: z.boolean().optional(),
    messages: z.array(messageSchema).min(1).optional(),
    parent_conversation_id: z.string().optional(),
    parent_message_id: z.string().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: "At least one field must be provided for update",
  });

export const deleteChatCompletionParamsSchema = z.object({
  completion_id: z.string().meta({
    description: "The ID of the chat completion to delete.",
  }),
});

export const checkChatCompletionParamsSchema = z.object({
  completion_id: z.string().min(1, "completion_id is required").meta({
    description: "The ID of the chat completion to retrieve.",
  }),
});

export const checkChatCompletionJsonSchema = z.object({
  role: z.enum(["user", "assistant", "tool"]).optional().meta({
    description: "The role of the message author to check.",
  }),
});

export const submitChatCompletionFeedbackParamsSchema = z.object({
  completion_id: z.string().min(1, "completion_id is required").meta({
    description: "The ID of the chat completion to retrieve.",
  }),
});

export const submitChatCompletionFeedbackJsonSchema = z.object({
  log_id: z.string().min(1, "log_id is required"),
  feedback: z.union([z.literal(1), z.literal(-1)]),
  score: z.number().min(0).max(100).optional(),
});

export const shareConversationParamsSchema = z.object({
  completion_id: z.string().min(1),
});

export const unshareConversationParamsSchema = z.object({
  completion_id: z.string().min(1),
});

export const getSharedConversationParamsSchema = z.object({
  share_id: z.string().min(1),
});

export const getChatCompletionResponseSchema = z.object({
  id: z.string(),
  active_operation: threadOperationSchema.nullable().optional(),
  latest_run: chatRunSchema.nullable().optional(),
  has_branches: z.boolean().optional(),
  type: conversationTypeSchema,
  title: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  model: z.string(),
  is_archived: z.boolean(),
  user_id: z.string().nullable(),
  share_id: z.string().nullable(),
  project_id: z.string().nullable().optional(),
  settings: z.record(z.string(), z.any()).optional(),
  messages: z.array(storedChatMessageResponseSchema).optional(),
  message_count: z.number().int().nonnegative().optional(),
  has_more_messages: z.boolean().optional(),
  oldest_message_id: z.string().nullable().optional(),
});

export const getChatCompletionMessagesResponseSchema = z.object({
  messages: z.array(storedChatMessageResponseSchema),
  conversation_id: z.string(),
  has_more: z.boolean().optional(),
  oldest_message_id: z.string().nullable().optional(),
});

export const compactChatCompletionResponseSchema = z
  .object({
    compacted: z.boolean(),
    conversation: z
      .object({
        messages: z.array(storedChatMessageResponseSchema),
      })
      .passthrough(),
  })
  .superRefine((response, ctx) => {
    if (
      response.compacted &&
      !response.conversation.messages.some((message) => normaliseCompactionStatusMessage(message))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["conversation", "messages"],
        message: "Compacted responses must include a visible compaction message",
      });
    }
  });

export const cancelChatCompletionResponseSchema = z.object({
  cancelled: z.literal(true),
  completion_id: z.string(),
});

export type CancelChatCompletionResponse = z.infer<typeof cancelChatCompletionResponseSchema>;
export type CompactChatCompletionResponse = z.infer<typeof compactChatCompletionResponseSchema>;
export type SubmitChatCompletionFeedbackInput = z.infer<
  typeof submitChatCompletionFeedbackJsonSchema
>;

export const getMessageResponseSchema = storedChatMessageResponseSchema.and(
  z.object({
    id: z.string(),
    conversation_id: z.string(),
  }),
);
