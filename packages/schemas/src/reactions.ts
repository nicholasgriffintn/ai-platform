import z from "zod/v4";

export const REACTION_PALETTE = ["👍", "👎", "❤️", "🎉", "😂", "👀", "✅", "🙏"] as const;

export const ACKNOWLEDGE_REACTION = "👀";
export const DONE_REACTION = "✅";
export const FAILED_REACTION = "⚠️";

export const REACT_TOOL_NAME = "react";

export const reactionEmojiSchema = z.string().trim().min(1).max(16);

export const reactionActorSchema = z.enum(["person", "teammate"]);

export type ReactionActor = z.infer<typeof reactionActorSchema>;

export const messageReactionSchema = z.object({
  emoji: reactionEmojiSchema,
  actor: reactionActorSchema,
  actor_id: z.string().min(1),
  created_at: z.string().min(1),
});

export type MessageReaction = z.infer<typeof messageReactionSchema>;

export const messageReactionsSchema = z.array(messageReactionSchema);

export const itemReactionRequestSchema = z.object({
  item_id: z.string().min(1),
  emoji: reactionEmojiSchema,
  remove: z.boolean().optional(),
});

export type ItemReactionRequest = z.infer<typeof itemReactionRequestSchema>;

export const itemReactionResponseSchema = z.object({
  item_id: z.string(),
  reactions: messageReactionsSchema,
});

export type ItemReactionResponse = z.infer<typeof itemReactionResponseSchema>;

export const itemReactionEnvelopeSchema = z.object({ response: itemReactionResponseSchema });

export const reactToolInputSchema = z.object({
  emoji: reactionEmojiSchema.describe(
    "One emoji. Use 👀 to say you have picked something up, 👍 to agree, ✅ when a request is done.",
  ),
  item_id: z
    .string()
    .min(1)
    .optional()
    .describe("The message to react to. Leave it out to react to the person's latest message."),
  remove: z.boolean().optional().describe("Remove this reaction instead of adding it."),
});

export type ReactToolInput = z.infer<typeof reactToolInputSchema>;
