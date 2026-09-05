import z from "zod/v4";

export const conversationGroupScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("personal") }),
  z.object({ kind: z.literal("project"), projectId: z.string().min(1) }),
]);

export const conversationGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(40),
  scope: conversationGroupScopeSchema,
});

export const conversationSnoozeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("until"), until: z.iso.datetime() }),
  z.object({ kind: z.literal("next_response") }),
]);

export const conversationOrganisationSchema = z.object({
  conversationId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  isPinned: z.boolean(),
  isUnread: z.boolean(),
  snooze: conversationSnoozeSchema.nullable(),
  group: conversationGroupSchema.nullable(),
  availableGroups: z.array(conversationGroupSchema),
  updatedAt: z.string().nullable(),
});

export const updateConversationOrganisationSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    isPinned: z.boolean().optional(),
    isUnread: z.boolean().optional(),
    snooze: conversationSnoozeSchema.nullable().optional(),
  })
  .refine(
    ({ isPinned, isUnread, snooze }) =>
      isPinned !== undefined || isUnread !== undefined || snooze !== undefined,
    "At least one organisation field must be provided",
  );

export const createConversationGroupSchema = z.object({
  name: z.string().trim().min(1).max(40),
  scope: conversationGroupScopeSchema,
});

export const conversationGroupParamsSchema = z.object({ groupId: z.string().min(1) });
export const conversationOrganisationParamsSchema = z.object({
  completionId: z.string().min(1),
});
export const moveConversationToGroupSchema = z.object({
  groupId: z.string().min(1).nullable(),
});

export type ConversationGroupScope = z.infer<typeof conversationGroupScopeSchema>;
export type ConversationGroup = z.infer<typeof conversationGroupSchema>;
export type ConversationSnooze = z.infer<typeof conversationSnoozeSchema>;
export type ConversationOrganisation = z.infer<typeof conversationOrganisationSchema>;
export type UpdateConversationOrganisation = z.infer<typeof updateConversationOrganisationSchema>;
export type CreateConversationGroup = z.infer<typeof createConversationGroupSchema>;
export type MoveConversationToGroup = z.infer<typeof moveConversationToGroupSchema>;
