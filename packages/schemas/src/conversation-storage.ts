import z from "zod/v4";

export const CONVERSATION_RETENTION = ["kept", "temporary"] as const;
export const conversationRetentionSchema = z.enum(CONVERSATION_RETENTION);
export type ConversationRetention = z.infer<typeof conversationRetentionSchema>;

export const RETENTION_REASONS = [
  "pending",
  "chosen",
  "default",
  "signed_out",
  "plan",
  "device_default",
] as const;
export const retentionReasonSchema = z.enum(RETENTION_REASONS);
export type RetentionReason = z.infer<typeof retentionReasonSchema>;
