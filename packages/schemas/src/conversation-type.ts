import z from "zod/v4";

export const conversationTypeSchema = z.enum(["chat", "task", "meta", "delegate"]);

export type ConversationType = z.infer<typeof conversationTypeSchema>;
