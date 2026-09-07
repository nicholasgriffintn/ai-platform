import z from "zod/v4";

export const CHAT_MODES = ["chat", "tool", "agent"] as const;

export const chatModeSchema = z.enum(CHAT_MODES);

export type ChatMode = z.infer<typeof chatModeSchema>;
