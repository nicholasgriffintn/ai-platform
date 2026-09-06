import z from "zod/v4";

export const SAVED_MESSAGES_TOOL_NAME = "list_saved_messages";

export const savedMessageSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  conversationId: z.string(),
  conversationTitle: z.string().nullable(),
  note: z.string().nullable(),
  excerpt: z.string(),
  savedAt: z.string(),
});

export const listSavedMessagesResponseSchema = z.object({
  messages: z.array(savedMessageSchema),
});

export const saveMessageSchema = z.object({
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
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

export type SavedMessage = z.infer<typeof savedMessageSchema>;
export type SaveMessageInput = z.infer<typeof saveMessageSchema>;
export type ListSavedMessagesInput = z.infer<typeof listSavedMessagesInputSchema>;
