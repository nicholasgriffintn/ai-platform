import z from "zod/v4";

export const conversationTypeSchema = z.enum(["chat", "task", "poly", "delegate"]);

export type ConversationType = z.infer<typeof conversationTypeSchema>;
