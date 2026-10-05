import z from "zod/v4";

import { inboundChannelIdSchema } from "./chat-mode.js";

export const channelBindingScopeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("personal") }),
  z.object({ type: z.literal("project"), projectId: z.string().min(1) }),
]);

export const channelSenderIdsSchema = z
  .array(z.string().trim().min(1).max(200))
  .min(1)
  .max(100)
  .refine((ids) => new Set(ids).size === ids.length, "Sender identifiers must be unique");

export const channelBindingSchema = z.object({
  id: z.string(),
  revision: z.number().int().positive(),
  channel: inboundChannelIdSchema,
  scopeType: z.enum(["personal", "project"]),
  scopeId: z.string(),
  externalId: z.string(),
  workspaceId: z.string(),
  allowedSenderIds: z.array(z.string()),
  replyMode: z.enum(["mentions", "all"]),
  label: z.string().nullable(),
  teammateId: z.string().nullable(),
  interactionMode: z.enum(["direct", "automated"]),
  enabled: z.boolean(),
  createdAt: z.string(),
});

export const createChannelBindingSchema = z
  .object({
    channel: inboundChannelIdSchema,
    externalId: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .describe("The channel's own identifier for where messages arrive, such as a Slack channel."),
    workspaceId: z
      .string()
      .trim()
      .regex(/^T[A-Z0-9]+$/)
      .optional(),
    allowedSenderIds: channelSenderIdsSchema,
    replyMode: z.enum(["mentions", "all"]).default("mentions"),
    projectId: z.string().min(1).optional(),
    label: z.string().trim().min(1).max(120).optional(),
    teammateId: z.string().min(1).optional(),
    interactionMode: z.enum(["direct", "automated"]).default("automated"),
  })
  .superRefine((input, ctx) => {
    if (input.channel === "slack" && !input.workspaceId) {
      ctx.addIssue({
        code: "custom",
        path: ["workspaceId"],
        message: "A Slack workspace identifier is required",
      });
    }

    if (input.channel !== "slack" && input.workspaceId) {
      ctx.addIssue({
        code: "custom",
        path: ["workspaceId"],
        message: "Workspace identifiers are only used for Slack",
      });
    }
  });

export const listChannelBindingsResponseSchema = z.object({
  bindings: z.array(channelBindingSchema),
});

export type ChannelBinding = z.infer<typeof channelBindingSchema>;
export type ChannelBindingScope = z.infer<typeof channelBindingScopeSchema>;
export type CreateChannelBindingInput = z.input<typeof createChannelBindingSchema>;

export const inboundChannelMessageSchema = z.object({
  messageId: z.string().min(1).max(200),
  from: z.string().min(1).max(200),
  to: z.string().max(200).optional(),
  body: z.string().max(40_000),
  media: z
    .array(z.object({ url: z.url(), mimeType: z.string().optional() }))
    .max(20)
    .optional(),
});

export const channelThreadReferenceSchema = z.object({
  workspaceId: z.string(),
  externalId: z.string().min(1).max(200),
  threadId: z.string().min(1).max(200),
  revision: z.number().int().positive(),
  bindingRevision: z.number().int().positive(),
});

export const inboundBindingTaskSchema = z.object({
  channel: inboundChannelIdSchema,
  bindingId: z.string().min(1),
  thread: channelThreadReferenceSchema,
  message: inboundChannelMessageSchema,
});

export const inboundProviderTaskSchema = z.object({
  channel: z.literal("sms"),
  providerId: z.enum(["twilio-sms", "aws-sms"]),
  providerSettingsId: z.string().min(1),
  message: inboundChannelMessageSchema,
});

export const inboundChannelTaskSchema = z.union([
  inboundBindingTaskSchema,
  inboundProviderTaskSchema,
]);

export const channelIncomingMessageSchema = inboundChannelMessageSchema.omit({ to: true }).extend({
  kind: z.literal("message"),
  externalId: z.string().min(1).max(200),
  workspaceId: z.string(),
  threadId: z.string().min(1).max(200),
  mentioned: z.boolean(),
  directMessage: z.boolean(),
});

export type InboundChannelMessage = z.infer<typeof inboundChannelMessageSchema>;
export type InboundBindingTaskData = z.infer<typeof inboundBindingTaskSchema>;
export type InboundProviderTaskData = z.infer<typeof inboundProviderTaskSchema>;
export type InboundChannelTaskData = z.infer<typeof inboundChannelTaskSchema>;
export type ChannelThreadReference = z.infer<typeof channelThreadReferenceSchema>;
export type ChannelIncomingMessage = z.infer<typeof channelIncomingMessageSchema>;

export const channelRunAuthoritySchema = z.object({
  bindingId: z.string().min(1),
  thread: channelThreadReferenceSchema,
  from: z.string().min(1),
});

export type ChannelRunAuthority = z.infer<typeof channelRunAuthoritySchema>;

export const updateChannelBindingSchema = z.object({
  expectedRevision: z.number().int().positive(),
  allowedSenderIds: channelSenderIdsSchema,
  replyMode: z.enum(["mentions", "all"]),
  enabled: z.boolean(),
});

export type UpdateChannelBindingInput = z.infer<typeof updateChannelBindingSchema>;
