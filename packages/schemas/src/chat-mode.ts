import z from "zod/v4";

export const homeChatModeIdSchema = z.enum(["background", "chat", "live", "sms"]);

export const conversationSmsRequestOptionsSchema = z.object({
  enabled: z.boolean(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

export const conversationModeRequestOptionsSchema = z
  .object({
    sms: conversationSmsRequestOptionsSchema.optional(),
  })
  .passthrough();

export const conversationModeMetadataSchema = z
  .object({
    mode: homeChatModeIdSchema,
    requestOptions: conversationModeRequestOptionsSchema.optional(),
    smsSettings: z
      .object({
        from: z.string().trim().optional(),
        to: z.string().trim().optional(),
      })
      .optional(),
  })
  .passthrough();

export type HomeChatModeId = z.infer<typeof homeChatModeIdSchema>;
export type ConversationSmsRequestOptions = z.infer<typeof conversationSmsRequestOptionsSchema>;
export type ConversationModeRequestOptions = z.infer<typeof conversationModeRequestOptionsSchema>;
export type ConversationModeMetadata = z.infer<typeof conversationModeMetadataSchema>;
