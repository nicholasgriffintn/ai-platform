import z from "zod/v4";

import { listQuerySchema, listSchema } from "./platform/list.js";

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

export const activityListQuerySchema = listQuerySchema.extend({
  project_id: z.string().min(1).optional(),
  conversation_id: z.string().min(1).optional(),
  capability_id: z.string().min(1).optional(),
  status: activityStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ActivityListQuery = z.infer<typeof activityListQuerySchema>;

export const activityListResponseSchema = listSchema(activityRecordSchema);

export type ActivityStatus = z.infer<typeof activityStatusSchema>;
export type ActivityRecord = z.infer<typeof activityRecordSchema>;
