import z from "zod/v4";

export const chatInputPolicySchema = z
  .object({
    toolOutputRewriting: z.enum(["off", "compact_json"]),
  })
  .strict();
export const chatInputPolicyRevisionSchema = z.object({
  revision: z.number().int().positive(),
  policy: chatInputPolicySchema,
  changedAt: z.string(),
  changedBy: z.number().int().positive(),
});
export const chatInputPolicyStateSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    policy: chatInputPolicySchema,
    history: z.array(chatInputPolicyRevisionSchema).max(20),
  })
  .strict();
export const updateChatInputPolicySchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    policy: chatInputPolicySchema,
  })
  .strict();
export const previewChatInputPolicySchema = z
  .object({
    policy: chatInputPolicySchema,
    content: z.string().max(1_000_000),
  })
  .strict();
export const chatInputPolicyPreviewSchema = z.object({
  content: z.string(),
  changed: z.boolean(),
  originalCharacters: z.number(),
  rewrittenCharacters: z.number(),
  estimatedTokensSaved: z.number(),
});
export type ChatInputPolicy = z.infer<typeof chatInputPolicySchema>;
export type ChatInputPolicyState = z.infer<typeof chatInputPolicyStateSchema>;
export type UpdateChatInputPolicy = z.infer<typeof updateChatInputPolicySchema>;
export type ChatInputPolicyPreview = z.infer<typeof chatInputPolicyPreviewSchema>;
export type PreviewChatInputPolicy = z.infer<typeof previewChatInputPolicySchema>;
