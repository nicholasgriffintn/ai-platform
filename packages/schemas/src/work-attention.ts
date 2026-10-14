import z from "zod/v4";

import { listQuerySchema, listSchema } from "./platform/list.js";

export const WORK_ATTENTION_KINDS = [
  "approval",
  "input",
  "review",
  "failed",
  "running",
  "completed",
] as const;
export const WORK_ATTENTION_TYPES = ["task", "run"] as const;

export const workAttentionKindSchema = z.enum(WORK_ATTENTION_KINDS);
export const workAttentionTypeSchema = z.enum(WORK_ATTENTION_TYPES);

export const workAttentionQuerySchema = listQuerySchema
  .extend({
    kind: workAttentionKindSchema.optional(),
    workspace_id: z.string().trim().min(1).optional(),
    project_id: z.string().trim().min(1).optional(),
    owner_user_id: z.coerce.number().int().positive().optional(),
    type: workAttentionTypeSchema.optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .refine(
    ({ from, to }) => !from || !to || Date.parse(from) <= Date.parse(to),
    "The start date must not be after the end date",
  );

export const workAttentionItemSchema = z.object({
  id: z.string().min(1),
  kind: workAttentionKindSchema,
  type: workAttentionTypeSchema,
  resourceId: z.string().min(1),
  workspaceId: z.string().min(1),
  workspaceName: z.string().min(1),
  projectId: z.string().min(1),
  projectName: z.string().min(1),
  conversationId: z.string().nullable(),
  ownerUserId: z.number().int().positive(),
  ownerName: z.string().min(1),
  isUnread: z.boolean(),
  title: z.string().min(1),
  detail: z.string().nullable(),
  occurredAt: z.string().min(1),
});

const workAttentionFacetSchema = z.object({ id: z.string().min(1), name: z.string().min(1) });

export const workAttentionResponseSchema = listSchema(workAttentionItemSchema).extend({
  total: z.number().int().nonnegative(),
  facets: z.object({
    workspaces: z.array(workAttentionFacetSchema),
    projects: z.array(workAttentionFacetSchema.extend({ workspaceId: z.string().min(1) })),
    owners: z.array(z.object({ id: z.number().int().positive(), name: z.string().min(1) })),
  }),
});

export type WorkAttentionKind = z.infer<typeof workAttentionKindSchema>;
export type WorkAttentionType = z.infer<typeof workAttentionTypeSchema>;
export type WorkAttentionQuery = z.infer<typeof workAttentionQuerySchema>;
export type WorkAttentionItem = z.infer<typeof workAttentionItemSchema>;
export type WorkAttentionResponse = z.infer<typeof workAttentionResponseSchema>;
