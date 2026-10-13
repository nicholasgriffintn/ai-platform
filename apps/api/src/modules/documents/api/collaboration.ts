import {
  createDocumentCommentSchema,
  documentCommentListSchema,
  documentCommentListQuerySchema,
  documentCommentSchema,
  documentEditProposalSchema,
  outputSchema,
  proposeDocumentEditSchema,
  resolveDocumentThreadSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";

import {
  createDocumentComment,
  listDocumentComments,
  resolveDocumentThread,
} from "../application/comments";
import { applyDocumentEdit, proposeDocumentEdit } from "../application/selection-edits";

const app = new Hono();
const outputParams = z.object({ outputId: z.string().min(1) });

addRoute(app, "get", "/:outputId/comments", {
  tags: ["documents"],
  auth: true,
  paramSchema: outputParams,
  querySchema: documentCommentListQuerySchema,
  responses: { 200: { description: "Document discussion", schema: documentCommentListSchema } },
  handler: ({ serviceContext, user, params, query }) =>
    listDocumentComments(serviceContext, user.id, params.outputId, query.after),
});

addRoute(app, "post", "/:outputId/comments", {
  tags: ["documents"],
  auth: true,
  paramSchema: outputParams,
  bodySchema: createDocumentCommentSchema,
  responses: { 200: { description: "Saved comment", schema: documentCommentSchema } },
  handler: ({ serviceContext, user, params, body }) =>
    createDocumentComment(serviceContext, user.id, params.outputId, body),
});

addRoute(app, "put", "/:outputId/comments/:commentId", {
  tags: ["documents"],
  auth: true,
  paramSchema: outputParams.extend({ commentId: z.string().min(1) }),
  bodySchema: resolveDocumentThreadSchema,
  responses: { 200: { description: "Updated thread", schema: documentCommentSchema } },
  handler: ({ serviceContext, user, params, body }) =>
    resolveDocumentThread(serviceContext, user.id, params.outputId, params.commentId, body),
});

addRoute(app, "post", "/:outputId/edits/propose", {
  tags: ["documents"],
  auth: true,
  paramSchema: outputParams,
  bodySchema: proposeDocumentEditSchema,
  responses: {
    200: { description: "Proposed selection edit", schema: documentEditProposalSchema },
  },
  handler: ({ serviceContext, user, params, body }) =>
    proposeDocumentEdit(serviceContext, user, params.outputId, body),
});

addRoute(app, "post", "/:outputId/edits/apply", {
  tags: ["documents"],
  auth: true,
  paramSchema: outputParams,
  bodySchema: documentEditProposalSchema,
  responses: { 200: { description: "Saved document revision", schema: outputSchema } },
  handler: ({ serviceContext, user, params, body }) =>
    applyDocumentEdit(serviceContext, user.id, params.outputId, body),
});

export default app;
