import z from "zod/v4";

export const homeChatModeIdSchema = z.enum(["chat", "live", "sms"]);

export const inboundChannelIdSchema = z.enum(["sms"]);

export const conversationChannelRequestOptionsSchema = z.object({
  id: inboundChannelIdSchema,
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

export const conversationModeRequestOptionsSchema = z
  .object({
    channel: conversationChannelRequestOptionsSchema.optional(),
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
export type InboundChannelId = z.infer<typeof inboundChannelIdSchema>;
export type ConversationChannelRequestOptions = z.infer<
  typeof conversationChannelRequestOptionsSchema
>;
export type ConversationModeRequestOptions = z.infer<typeof conversationModeRequestOptionsSchema>;
export type ConversationModeMetadata = z.infer<typeof conversationModeMetadataSchema>;
