import {
  councilReviewListResponseSchema,
  councilReviewSchema,
  createOutputSchema,
  createOutputShareSchema,
  describeDocumentInputSchema,
  describeDocumentResponseSchema,
  DOCUMENT_OUTPUT_KIND,
  documentExportFilename,
  formatDocumentInputSchema,
  formatDocumentResponseSchema,
  outputHistoryResponseSchema,
  outputListQuerySchema,
  outputListResponseSchema,
  outputSchema,
  outputShareDeliverySchema,
  outputShareListResponseSchema,
  readDocumentBody,
  restoreOutputRevisionSchema,
  sharedOutputSchema,
  applyDocumentEditSchema,
  updateOutputSchema,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import { StorageService } from "~/infrastructure/storage";
import { getPrivateFileResponse, readPrivateFile } from "~/infrastructure/storage/read-resource";
import { defineDocumentCollaboration } from "~/modules/documents/api/collaboration";
import { formatDocument, redescribeDocument } from "~/modules/documents/application";
import { applyDocumentEdit } from "~/modules/documents/application/selection-edits";
import {
  createOutput,
  createOutputShare,
  deleteOutput,
  getOutput,
  getSharedOutput,
  getSharedOutputRecord,
  listOutputRevisions,
  listOutputs,
  listOutputShares,
  restoreOutputRevision,
  revokeOutputShare,
  updateOutput,
} from "~/modules/outputs/application";
import { listOutputReviews, reviewOutput } from "~/modules/outputs/application/review";

const app = new Hono();
const outputParamsSchema = z.object({ output_id: z.string().min(1) });
const revisionParamsSchema = outputParamsSchema.extend({
  revision_id: z.coerce.number().int().positive(),
});
const shareParamsSchema = outputParamsSchema.extend({ share_id: z.string().min(1) });
const sharedParamsSchema = z.object({ token: z.string().min(32) });
const createOutputRequestSchema = createOutputSchema.omit({ file: true });

defineResource(app, { idParam: "output_id", tags: ["outputs"] }, (outputs) => {
  outputs
    .list({
      auth: true,
      summary: "List outputs",
      description: "Personal outputs, or a project's when project_id is set.",
      querySchema: outputListQuerySchema,
      responses: { 200: { description: "Outputs", schema: outputListResponseSchema } },
      handler: ({ query, serviceContext, user }) => listOutputs(serviceContext, user.id, query),
    })
    .create({
      auth: true,
      summary: "Create an output",
      bodySchema: createOutputRequestSchema,
      responses: { 200: { description: "The output", schema: outputSchema } },
      handler: ({ body, serviceContext, user }) => createOutput(serviceContext, user.id, body),
    })
    .read({
      auth: true,
      summary: "Read an output",
      paramSchema: outputParamsSchema,
      responses: { 200: { description: "The output", schema: outputSchema } },
      handler: ({ params, serviceContext, user }) =>
        getOutput(serviceContext, user.id, params.output_id),
    })
    .update({
      auth: true,
      summary: "Save an output revision",
      paramSchema: outputParamsSchema,
      description:
        "Send fields to change, or edit with a proposal from POST /outputs/{output_id}/edits to apply it to the document.",
      bodySchema: z.union([updateOutputSchema, applyDocumentEditSchema]),
      responses: { 200: { description: "The output", schema: outputSchema } },
      handler: ({ body, params, serviceContext, user }) =>
        "edit" in body
          ? applyDocumentEdit(serviceContext, user.id, params.output_id, body.edit)
          : updateOutput(serviceContext, user.id, params.output_id, body),
    })
    .delete({
      auth: true,
      summary: "Delete an output",
      paramSchema: outputParamsSchema,
      handler: async ({ params, serviceContext, user }) => {
        await deleteOutput(serviceContext, user.id, params.output_id);

        return { deleted: true };
      },
    })
    .action("format", {
      auth: true,
      tags: ["outputs", "documents"],
      summary: "Rewrite a document without changing what it says",
      paramSchema: outputParamsSchema,
      bodySchema: formatDocumentInputSchema,
      responses: {
        200: { description: "Rewritten document", schema: formatDocumentResponseSchema },
      },
      handler: ({ body, params, serviceContext, user }) =>
        formatDocument(serviceContext, user, params.output_id, body.prompt),
    })
    .action("describe", {
      auth: true,
      tags: ["outputs", "documents"],
      summary: "Describe a document and keep the description on it",
      paramSchema: outputParamsSchema,
      bodySchema: describeDocumentInputSchema,
      responses: {
        200: { description: "Description", schema: describeDocumentResponseSchema },
      },
      handler: ({ body, params, serviceContext, user }) =>
        redescribeDocument(serviceContext, user, params.output_id, body.expectedRevision),
    })
    .shared({
      auth: false,
      summary: "Read a shared output",
      paramSchema: sharedParamsSchema,
      responses: { 200: { description: "Shared output", schema: sharedOutputSchema } },
      handler: ({ params, serviceContext }) => getSharedOutput(serviceContext, params.token),
    })
    .shared(
      {
        auth: false,
        summary: "Download a shared output's file",
        paramSchema: sharedParamsSchema,
        responses: { 200: { description: "Shared output file" } },
        handler: async ({ params, serviceContext }) => {
          const record = await getSharedOutputRecord(serviceContext, params.token);

          if (!record.storage_key || !record.mime_type) {
            throw new AssistantError("Shared output file not found", ErrorType.NOT_FOUND, 404);
          }

          const object = await new StorageService(
            serviceContext.env.PRIVATE_ASSETS_BUCKET,
          ).getObjectBody(record.storage_key);

          if (!object) {
            throw new AssistantError("Shared output file not found", ErrorType.NOT_FOUND, 404);
          }

          return getPrivateFileResponse(record, object);
        },
      },
      "content",
    );

  outputs.singleton("content").read({
    auth: "user-or-anonymous",
    tags: ["outputs", "documents"],
    summary: "Download an output's content",
    description: "Returns the stored file, or a document output as Markdown.",
    paramSchema: outputParamsSchema,
    responses: { 200: { description: "Output file or Markdown document" } },
    handler: async ({ params, serviceContext, user }) => {
      const record = await serviceContext.repositories.outputs.getOutput(params.output_id);

      if (record?.kind === DOCUMENT_OUTPUT_KIND && !record.storage_key) {
        if (!user) {
          throw new AssistantError("Authentication required", ErrorType.AUTHENTICATION_ERROR, 401);
        }

        const output = await getOutput(serviceContext, user.id, params.output_id);
        const body = readDocumentBody(output.content);

        if (body !== null) {
          return new Response(body, {
            headers: {
              "content-type": "text/markdown; charset=utf-8",
              "content-disposition": `attachment; filename="${documentExportFilename(output.title)}"`,
            },
          });
        }
      }

      const file = await readPrivateFile({
        context: serviceContext,
        kind: "output",
        resourceId: params.output_id,
        userId: user?.id,
      });

      return getPrivateFileResponse(file.record, file.object);
    },
  });

  outputs
    .revisioned()
    .list({
      auth: true,
      summary: "List an output's revisions",
      paramSchema: outputParamsSchema,
      responses: { 200: { description: "Revisions", schema: outputHistoryResponseSchema } },
      handler: ({ params, serviceContext, user }) =>
        listOutputRevisions(serviceContext, user.id, params.output_id),
    })
    .restore({
      auth: true,
      summary: "Restore an earlier revision",
      paramSchema: revisionParamsSchema,
      bodySchema: restoreOutputRevisionSchema,
      responses: { 200: { description: "The output", schema: outputSchema } },
      handler: ({ body, params, serviceContext, user }) =>
        restoreOutputRevision(serviceContext, user.id, params.output_id, params.revision_id, body),
    });

  outputs
    .sub("reviews", "review_id")
    .list({
      auth: true,
      summary: "List council reviews of an output",
      paramSchema: outputParamsSchema,
      responses: { 200: { description: "Reviews", schema: councilReviewListResponseSchema } },
      handler: ({ params, serviceContext }) => listOutputReviews(serviceContext, params.output_id),
    })
    .create({
      auth: true,
      summary: "Ask the council to review an output",
      description:
        "Four seats critique the current revision, read each other's critiques and vote; an adjudicator returns ship, revise or hold with a revision brief.",
      paramSchema: outputParamsSchema,
      responses: { 200: { description: "The review", schema: councilReviewSchema } },
      handler: ({ params, serviceContext }) =>
        reviewOutput(serviceContext, params.output_id, {
          completionId: `output-review:${params.output_id}`,
          usageScopeId: `output-review:${params.output_id}:${Date.now()}`,
        }),
    });

  outputs
    .sub("shares", "share_id")
    .list({
      auth: true,
      summary: "List an output's active share links",
      paramSchema: outputParamsSchema,
      responses: { 200: { description: "Shares", schema: outputShareListResponseSchema } },
      handler: ({ params, serviceContext, user }) =>
        listOutputShares(serviceContext, user.id, params.output_id),
    })
    .create({
      auth: true,
      summary: "Create a share link",
      paramSchema: outputParamsSchema,
      bodySchema: createOutputShareSchema,
      responses: { 200: { description: "The share", schema: outputShareDeliverySchema } },
      handler: ({ body, params, serviceContext, user }) =>
        createOutputShare(serviceContext, user.id, params.output_id, body.expiresAt),
    })
    .delete({
      auth: true,
      summary: "Revoke a share link",
      paramSchema: shareParamsSchema,
      handler: async ({ params, serviceContext, user }) => {
        await revokeOutputShare(serviceContext, user.id, params.output_id, params.share_id);

        return { deleted: true };
      },
    });

  defineDocumentCollaboration(outputs);
});

export default app;
