import z from "zod/v4";

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

export const workAttentionQuerySchema = z
  .object({
    kind: workAttentionKindSchema.optional(),
    workspaceId: z.string().trim().min(1).optional(),
    projectId: z.string().trim().min(1).optional(),
    ownerUserId: z.coerce.number().int().positive().optional(),
    type: workAttentionTypeSchema.optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).default(0),
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

export const workAttentionResponseSchema = z.object({
  items: z.array(workAttentionItemSchema),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
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
