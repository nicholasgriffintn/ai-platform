import {
  createDocumentCommentSchema,
  documentCommentListQuerySchema,
  documentCommentListSchema,
  documentCommentSchema,
  documentEditProposalSchema,
  outputSchema,
  proposeDocumentEditSchema,
  resolveDocumentThreadSchema,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { ResourceBuilder } from "~/infrastructure/http/resource";

import {
  createDocumentComment,
  listDocumentComments,
  resolveDocumentThread,
} from "../application/comments";
import { applyDocumentEdit, proposeDocumentEdit } from "../application/selection-edits";

const outputParamsSchema = z.object({ output_id: z.string().min(1) });

export function defineDocumentCollaboration(outputs: ResourceBuilder): void {
  outputs
    .sub("comments", "comment_id")
    .list({
      auth: true,
      tags: ["documents"],
      summary: "List a document's discussion",
      paramSchema: outputParamsSchema,
      querySchema: documentCommentListQuerySchema,
      responses: { 200: { description: "Discussion", schema: documentCommentListSchema } },
      handler: ({ serviceContext, user, params, query }) =>
        listDocumentComments(serviceContext, user.id, params.output_id, query.after),
    })
    .create({
      auth: true,
      tags: ["documents"],
      summary: "Comment on a document",
      paramSchema: outputParamsSchema,
      bodySchema: createDocumentCommentSchema,
      responses: { 200: { description: "The comment", schema: documentCommentSchema } },
      handler: ({ serviceContext, user, params, body }) =>
        createDocumentComment(serviceContext, user.id, params.output_id, body),
    })
    .update({
      auth: true,
      tags: ["documents"],
      summary: "Resolve or reopen a thread",
      paramSchema: outputParamsSchema.extend({ comment_id: z.string().min(1) }),
      bodySchema: resolveDocumentThreadSchema,
      responses: { 200: { description: "The thread", schema: documentCommentSchema } },
      handler: ({ serviceContext, user, params, body }) =>
        resolveDocumentThread(serviceContext, user.id, params.output_id, params.comment_id, body),
    });

  outputs
    .sub("edits", "edit_id")
    .create({
      auth: true,
      tags: ["documents"],
      summary: "Propose an edit to a selection",
      paramSchema: outputParamsSchema,
      bodySchema: proposeDocumentEditSchema,
      responses: { 200: { description: "Proposed edit", schema: documentEditProposalSchema } },
      handler: ({ serviceContext, user, params, body }) =>
        proposeDocumentEdit(serviceContext, user, params.output_id, body),
    })
    .collectionAction("apply", {
      auth: true,
      tags: ["documents"],
      summary: "Apply a proposed edit",
      paramSchema: outputParamsSchema,
      bodySchema: documentEditProposalSchema,
      responses: { 200: { description: "The document revision", schema: outputSchema } },
      handler: ({ serviceContext, user, params, body }) =>
        applyDocumentEdit(serviceContext, user.id, params.output_id, body),
    });
}
