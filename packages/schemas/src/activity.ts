import z from "zod/v4";

export const activityStatusSchema = z.enum([
  "queued",
  "running",
  "waiting",
  "succeeded",
  "failed",
  "cancelled",
]);

export const activityRecordSchema = z.object({
  id: z.string(),
  createdByUserId: z.number().int().positive(),
  projectId: z.string().nullable(),
  conversationId: z.string().nullable(),
  capabilityId: z.string(),
  groupId: z.string().nullable(),
  kind: z.string(),
  status: activityStatusSchema,
  summary: z.string(),
  data: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

export const activityListQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
  conversationId: z.string().min(1).optional(),
  capabilityId: z.string().min(1).optional(),
  status: activityStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const activityListResponseSchema = z.object({
  activities: z.array(activityRecordSchema),
  hasMore: z.boolean(),
});

export type ActivityStatus = z.infer<typeof activityStatusSchema>;
export type ActivityRecord = z.infer<typeof activityRecordSchema>;
