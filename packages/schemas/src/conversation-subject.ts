import z from "zod/v4";

export const CONVERSATION_SUBJECT_TYPES = ["output", "source", "memory", "discover_card"] as const;

export const conversationSubjectTypeSchema = z.enum(CONVERSATION_SUBJECT_TYPES);

export const conversationSubjectSchema = z
  .object({
    type: conversationSubjectTypeSchema,
    id: z.string().min(1).max(128),
  })
  .strict();

export type ConversationSubjectType = z.infer<typeof conversationSubjectTypeSchema>;
export type ConversationSubject = z.infer<typeof conversationSubjectSchema>;
