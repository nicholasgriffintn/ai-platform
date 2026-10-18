import z from "zod/v4";

export const TEAMMATE_GROUP_MIN_MEMBERS = 2;
export const TEAMMATE_GROUP_MAX_MEMBERS = 6;

export const teammateGroupSchema = z.object({
  conversationId: z.string(),
  name: z.string(),
  teammateIds: z.array(z.string()),
  projectId: z.string().nullable(),
  createdAt: z.string(),
});

export type TeammateGroup = z.infer<typeof teammateGroupSchema>;

export const createTeammateGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  teammateIds: z
    .array(z.string().min(1))
    .min(TEAMMATE_GROUP_MIN_MEMBERS)
    .max(TEAMMATE_GROUP_MAX_MEMBERS)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Add each teammate once",
    }),
  projectId: z.string().min(1).optional(),
});

export type CreateTeammateGroupInput = z.infer<typeof createTeammateGroupSchema>;

export const teammateRosterEntrySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("teammate"),
    teammateId: z.string(),
    conversationId: z.string(),
    lastActivityAt: z.string(),
    unread: z.boolean(),
  }),
  z.object({
    kind: z.literal("group"),
    conversationId: z.string(),
    name: z.string(),
    teammateIds: z.array(z.string()),
    lastActivityAt: z.string(),
    unread: z.boolean(),
  }),
]);

export type TeammateRosterEntry = z.infer<typeof teammateRosterEntrySchema>;
