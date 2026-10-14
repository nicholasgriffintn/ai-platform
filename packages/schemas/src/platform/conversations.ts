import z from "zod/v4";

import { conversationTypeSchema } from "../conversation-type.js";
import { messagePartsSchema } from "../message-parts.js";
import { modelTierSchema } from "../model-lineup.js";
import { permissionModeSchema } from "../providers.js";
import { messageSchema } from "../shared.js";
import { threadOperationSchema } from "../thread-operations.js";
import { storedItemSchema } from "./items.js";
import { listQuerySchema, listSchema } from "./list.js";
import { responseSchema } from "./responses.js";

export const conversationParamsSchema = z.object({
  conversation_id: z.string().min(1).meta({ description: "The conversation ID." }),
});

export type ConversationParams = z.infer<typeof conversationParamsSchema>;

export const conversationItemParamsSchema = conversationParamsSchema.extend({
  item_id: z.string().min(1),
});

export const conversationArchiveFilterSchema = z.enum(["active", "archived", "all"]);

export const conversationSortBySchema = z.enum(["updated", "created", "title"]);

export const conversationActivityWindowSchema = z.enum(["all", "today", "week", "month"]);

export const LISTED_CONVERSATION_TYPES = ["chat", "task"] as const;
export type ListedConversationType = (typeof LISTED_CONVERSATION_TYPES)[number];

export const SEARCHABLE_CONVERSATION_TYPES = ["chat", "task", "delegate"] as const;
export type SearchableConversationType = (typeof SEARCHABLE_CONVERSATION_TYPES)[number];

export type ConversationArchiveFilter = z.infer<typeof conversationArchiveFilterSchema>;
export type ConversationSortBy = z.infer<typeof conversationSortBySchema>;
export type ConversationActivityWindow = z.infer<typeof conversationActivityWindowSchema>;

export const listConversationsQuerySchema = listQuerySchema.extend({
  archived: conversationArchiveFilterSchema.optional(),
  q: z.string().trim().max(200).optional(),
  sort_by: conversationSortBySchema.optional().default("updated"),
  updated_after: z.iso.datetime().optional(),
  type: conversationTypeSchema.optional(),
});

export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;

export const conversationSummarySchema = z
  .object({
    id: z.string(),
    type: conversationTypeSchema,
    title: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    model: z.string().nullable().optional(),
    is_archived: z.boolean(),
    user_id: z.union([z.string(), z.number()]).nullable().optional(),
    share_id: z.string().nullable().optional(),
  })
  .passthrough();

export const conversationListResponseSchema = listSchema(conversationSummarySchema);

export const archiveConversationsRequestSchema = z.object({
  archived: z.boolean(),
  q: z.string().trim().max(200).optional(),
  updated_after: z.iso.datetime().optional(),
});

export const archiveConversationsResponseSchema = z.object({
  success: z.boolean(),
  archived: z.number(),
});

export const getConversationQuerySchema = z.object({
  refresh_pending: z.enum(["true", "false"]).optional().default("false"),
  item_limit: z.coerce.number().int().min(1).max(100).optional().default(100),
});

export const conversationSchema = z.object({
  object: z.literal("conversation").optional(),
  id: z.string(),
  active_operation: threadOperationSchema.nullable().optional(),
  latest_response: responseSchema.nullable().optional(),
  has_branches: z.boolean().optional(),
  type: conversationTypeSchema,
  title: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  model: z.string().nullable().optional(),
  model_tier: modelTierSchema.nullable().optional(),
  permission_mode: permissionModeSchema.optional(),
  is_archived: z.boolean(),
  user_id: z.number().int().nullable(),
  share_id: z.string().nullable(),
  project_id: z.string().nullable().optional(),
  parent_conversation_id: z.string().nullable().optional(),
  parent_message_id: z.string().nullable().optional(),
  settings: z.record(z.string(), z.any()).optional(),
  items: z.array(storedItemSchema).optional(),
  item_count: z.number().int().nonnegative().optional(),
  has_more_items: z.boolean().optional(),
  oldest_item_id: z.string().nullable().optional(),
});

export type Conversation = z.infer<typeof conversationSchema>;

export const conversationItemsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    after: z.string().optional(),
    before: z.string().optional(),
  })
  .refine(({ after, before }) => !(after && before), {
    message: "Use either after or before, not both",
  });

export const conversationItemsResponseSchema = z.object({
  object: z.literal("list"),
  conversation_id: z.string(),
  data: z.array(storedItemSchema),
  has_more: z.boolean(),
  last_id: z.string().nullable(),
});

export type ConversationItemsResponse = z.infer<typeof conversationItemsResponseSchema>;

export const conversationItemResponseSchema = storedItemSchema.and(
  z.object({ conversation_id: z.string() }),
);

export const updateConversationRequestSchema = z
  .object({
    title: z.string().optional(),
    archived: z.boolean().optional(),
    items: z.array(storedItemSchema).min(1).optional(),
    parent_conversation_id: z.string().optional(),
    parent_message_id: z.string().optional(),
    permission_mode: permissionModeSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: "At least one field must be provided for update",
  });

export type UpdateConversationRequest = z.infer<typeof updateConversationRequestSchema>;

const titleCompactionMessageSchema = z.object({
  role: z.literal("compaction"),
  content: z.union([z.string(), z.array(z.unknown())]),
  parts: messagePartsSchema.optional(),
});

export const generateConversationTitleRequestSchema = z.object({
  items: z.array(storedItemSchema).optional(),
  messages: z.array(z.union([messageSchema, titleCompactionMessageSchema])).optional(),
  store: z.boolean().optional(),
});

export const generateConversationTitleResponseSchema = z.object({
  success: z.boolean(),
  title: z.string(),
});

export const checkConversationRequestSchema = z.object({
  role: z.enum(["user", "assistant", "tool"]).optional(),
});

export const checkConversationResponseSchema = z.object({
  response: z.object({
    content: z.string(),
    data: z.object({
      provider: z.string(),
      isValid: z.boolean(),
      violations: z.array(z.string()),
      rawResponse: z.unknown().optional(),
    }),
  }),
});

export const conversationFeedbackRequestSchema = z.object({
  item_id: z.string().min(1).optional(),
  log_id: z.string().min(1).optional(),
  feedback: z.union([z.literal(1), z.literal(-1)]),
  score: z.number().min(0).max(100).optional(),
});

export type ConversationFeedbackRequest = z.infer<typeof conversationFeedbackRequestSchema>;

export const conversationFeedbackSubmissionSchema = z.object({
  message_id: z.string().min(1).optional(),
  log_id: z.string().min(1).optional(),
  feedback: z.union([z.literal(1), z.literal(-1)]),
  score: z.number().min(0).max(100).optional(),
});

export type ConversationFeedbackSubmission = z.infer<typeof conversationFeedbackSubmissionSchema>;

export const shareConversationResponseSchema = z.object({
  share_id: z.string(),
  shared_through: z.number().int(),
});

export const sharedConversationParamsSchema = z.object({
  token: z.string().min(1),
});

export const sharedConversationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  after: z.string().optional(),
});

export const sharedConversationResponseSchema = z.object({
  items: z.array(storedItemSchema),
  share_id: z.string(),
  shared_through: z.number().int().nullable(),
});

export const compactConversationResponseSchema = z.object({
  compacted: z.boolean(),
  conversation: conversationSchema.pick({ items: true }).passthrough(),
});

export type CompactConversationResponse = z.infer<typeof compactConversationResponseSchema>;

export const deleteConversationResponseSchema = z.object({
  success: z.boolean(),
});
