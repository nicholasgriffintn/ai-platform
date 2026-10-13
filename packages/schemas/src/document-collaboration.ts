import z from "zod/v4";

import { DOCUMENT_MAX_BODY } from "./documents.js";

export const documentAnchorSchema = z
  .object({
    quote: z.string().min(1).max(20_000),
    prefix: z.string().max(64),
    suffix: z.string().max(64),
  })
  .strict();

export const createDocumentCommentSchema = z
  .object({
    requestId: z.guid(),
    expectedRevision: z.number().int().positive(),
    parentId: z.string().min(1).nullable().default(null),
    anchor: documentAnchorSchema.nullable().default(null),
    body: z.string().trim().min(1).max(10_000),
    mentionedTeammateId: z.string().min(1).nullable().default(null),
  })
  .strict();

export const documentCommentSchema = z.object({
  id: z.string(),
  outputId: z.string(),
  parentId: z.string().nullable(),
  anchor: documentAnchorSchema.nullable(),
  sourceRevision: z.number().int().positive(),
  body: z.string(),
  authorUserId: z.number().int().positive(),
  resolved: z.boolean(),
  revision: z.number().int().positive(),
  mentionedTeammateId: z.string().nullable(),
  taskId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

export const documentCommentListSchema = z.object({
  comments: z.array(documentCommentSchema),
  nextCursor: z.string().nullable(),
  permissions: z.object({
    actorUserId: z.number().int().positive(),
    canEditDocument: z.boolean(),
    canResolveAllThreads: z.boolean(),
  }),
});

export const documentCommentListQuerySchema = z.object({ after: z.string().min(1).optional() });
export const resolveDocumentThreadSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    resolved: z.boolean(),
  })
  .strict();

export const proposeDocumentEditSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    anchor: documentAnchorSchema,
    instructions: z.string().trim().min(1).max(2000),
  })
  .strict();

export const documentEditProposalSchema = z
  .object({
    sourceRevision: z.number().int().positive(),
    anchor: documentAnchorSchema,
    replacement: z.string().max(DOCUMENT_MAX_BODY),
  })
  .strict();

export type DocumentAnchor = z.infer<typeof documentAnchorSchema>;
export type CreateDocumentCommentInput = z.infer<typeof createDocumentCommentSchema>;
export type DocumentComment = z.infer<typeof documentCommentSchema>;
export type ResolveDocumentThreadInput = z.infer<typeof resolveDocumentThreadSchema>;
export type ProposeDocumentEditInput = z.infer<typeof proposeDocumentEditSchema>;
export type DocumentEditProposal = z.infer<typeof documentEditProposalSchema>;
