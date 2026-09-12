import z from "zod/v4";

import { inboundChannelIdSchema } from "./chat-mode.js";

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
});

export const createChannelBindingSchema = z.object({
  channel: inboundChannelIdSchema,
  externalId: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe("The channel's own identifier for where messages arrive, such as a Slack channel."),
  projectId: z.string().min(1).optional(),
  label: z.string().trim().min(1).max(120).optional(),
  teammateId: z.string().min(1).optional(),
  interactionMode: z.enum(["direct", "automated"]).default("automated"),
});

export const listChannelBindingsResponseSchema = z.object({
  bindings: z.array(channelBindingSchema),
});

export type ChannelBinding = z.infer<typeof channelBindingSchema>;
export type ChannelBindingScope = z.infer<typeof channelBindingScopeSchema>;
export type CreateChannelBindingInput = z.input<typeof createChannelBindingSchema>;
