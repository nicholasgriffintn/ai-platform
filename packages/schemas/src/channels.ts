import z from "zod/v4";

import { inboundChannelIdSchema } from "./chat-mode.js";

export const slackChannelAddressSchema = z.string().regex(/^T[A-Z0-9]+:[CDG][A-Z0-9]+$/);

export const channelBindingScopeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("personal") }),
  z.object({ type: z.literal("project"), projectId: z.string().min(1) }),
]);

export const channelBindingSchema = z.object({
  id: z.string(),
  channel: inboundChannelIdSchema,
  scopeType: z.enum(["personal", "project"]),
  scopeId: z.string(),
  externalId: z.string(),
  label: z.string().nullable(),
  teammateId: z.string().nullable(),
  interactionMode: z.enum(["direct", "automated"]),
  enabled: z.boolean(),
  createdAt: z.string(),
  canManage: z.boolean(),
});

export const createChannelBindingSchema = z
  .object({
    channel: inboundChannelIdSchema,
    externalId: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .describe(
        "Slack workspace and channel IDs joined by a colon, or a Telegram private chat ID.",
      ),
    projectId: z.string().min(1).optional(),
    label: z.string().trim().min(1).max(120).optional(),
    teammateId: z.string().min(1).optional(),
    interactionMode: z.enum(["direct", "automated"]).default("automated"),
  })
  .refine(
    (binding) =>
      binding.channel !== "slack" ||
      slackChannelAddressSchema.safeParse(binding.externalId).success,
    {
      message: "Enter the Slack workspace and channel IDs as T…:C… (or T…:D… for a direct message)",
      path: ["externalId"],
    },
  );

export const listChannelBindingsResponseSchema = z.object({
  bindings: z.array(channelBindingSchema),
});

export const channelMessageContextSchema = z
  .object({
    externalId: z.string().min(1).max(200),
    threadId: z.string().min(1).max(200),
    isDirect: z.boolean(),
  })
  .strict();

export const channelSenderSchema = z.object({
  id: z.string(),
  senderId: z.string(),
  userId: z.number().int().positive(),
  revision: z.number().int().positive(),
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
  canRevoke: z.boolean(),
});

export const listChannelSendersResponseSchema = z.object({ senders: z.array(channelSenderSchema) });
export const channelPairingChallengeSchema = z.object({
  command: z.string(),
  expiresAt: z.string(),
});

export const revokeChannelSenderSchema = z
  .object({ expectedRevision: z.number().int().positive() })
  .strict();

export type ChannelBinding = z.infer<typeof channelBindingSchema>;
export type ChannelBindingScope = z.infer<typeof channelBindingScopeSchema>;
export type CreateChannelBindingInput = z.input<typeof createChannelBindingSchema>;
export type ChannelMessageContext = z.infer<typeof channelMessageContextSchema>;
export type ChannelSender = z.infer<typeof channelSenderSchema>;
export type ChannelPairingChallenge = z.infer<typeof channelPairingChallengeSchema>;
