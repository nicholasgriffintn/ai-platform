import z from "zod/v4";

import { listQuerySchema, listSchema } from "./platform/list.js";

export const SAVED_MESSAGES_TOOL_NAME = "list_saved_messages";

export const savedItemSchema = z.object({
  id: z.string(),
  conversation_id: z.string(),
  conversation_title: z.string().nullable(),
  note: z.string().nullable(),
  excerpt: z.string(),
  saved_at: z.string(),
});

export const savedItemParamsSchema = z.object({ item_id: z.string().min(1) });

export const listSavedItemsQuerySchema = listQuerySchema.extend({
  conversation_id: z.string().min(1).optional(),
});

export const savedItemListSchema = listSchema(savedItemSchema);

export const saveItemSchema = z.object({
  conversation_id: z.string().min(1),
  item_id: z.string().min(1),
  note: z.string().trim().min(1).max(500).optional(),
});

export const listSavedMessagesInputSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .optional()
    .describe("How many saved messages to return, newest first."),
});

export type SavedItem = z.infer<typeof savedItemSchema>;
export type SaveItemInput = z.infer<typeof saveItemSchema>;
export type ListSavedItemsQuery = Partial<z.infer<typeof listSavedItemsQuerySchema>>;
export type ListSavedMessagesInput = z.infer<typeof listSavedMessagesInputSchema>;
