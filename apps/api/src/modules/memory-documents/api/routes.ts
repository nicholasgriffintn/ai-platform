import {
  createMemoryDocumentSchema,
  listPageOf,
  memoryDocumentHistoryResponseSchema,
  memoryDocumentNameSchema,
  memoryDocumentSchema,
  updateMemoryDocumentSchema,
  type MemoryDocument,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { Hono } from "hono";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { defineResource } from "~/infrastructure/http/resource";
import {
  createMemoryDocument,
  deleteMemoryDocument,
  getMemoryDocument,
  listMemoryDocumentRevisions,
  listMemoryDocuments,
  updateMemoryDocument,
} from "~/modules/memory-documents/application/memory-documents";
import {
  getTeammateContextMemory,
  updateTeammateContextMemory,
} from "~/modules/teammates/application";

const app = new Hono();
const scopeQuerySchema = z.object({
  project_id: z.string().min(1).optional(),
  teammate_context_id: z.string().min(1).optional(),
});
const documentParamsSchema = z.object({ document_id: memoryDocumentNameSchema });

async function requireTeammateMemory(
  context: ServiceContext,
  teammateContextId: string,
  documentId: string,
): Promise<MemoryDocument> {
  const document = await getTeammateContextMemory(context, teammateContextId);

  if (document.name !== documentId) {
    throw new AssistantError("Memory document not found", ErrorType.NOT_FOUND, 404);
  }

  return document;
}

defineResource(app, { idParam: "document_id", tags: ["memory"] }, (documents) => {
  documents
    .list({
      auth: true,
      summary: "List memory documents",
      description:
        "Personal or project memory, or one teammate context's private memory when teammate_context_id is set.",
      querySchema: scopeQuerySchema,
      handler: async ({ serviceContext, query }) =>
        query.teammate_context_id
          ? listPageOf(
              [await getTeammateContextMemory(serviceContext, query.teammate_context_id)],
              (document) => document.name,
            )
          : listPageOf(
              (await listMemoryDocuments(serviceContext, query.project_id)).documents,
              (document) => document.name,
            ),
    })
    .create({
      auth: true,
      summary: "Create a memory document",
      bodySchema: createMemoryDocumentSchema,
      responses: { 200: { description: "The document", schema: memoryDocumentSchema } },
      handler: ({ serviceContext, body }) => createMemoryDocument(serviceContext, body),
    })
    .read({
      auth: true,
      summary: "Read a memory document",
      paramSchema: documentParamsSchema,
      querySchema: scopeQuerySchema,
      responses: { 200: { description: "The document", schema: memoryDocumentSchema } },
      handler: ({ serviceContext, params, query }) =>
        query.teammate_context_id
          ? requireTeammateMemory(serviceContext, query.teammate_context_id, params.document_id)
          : getMemoryDocument(serviceContext, params.document_id, query.project_id),
    })
    .update({
      auth: true,
      summary: "Save a memory document revision",
      paramSchema: documentParamsSchema,
      querySchema: scopeQuerySchema,
      bodySchema: updateMemoryDocumentSchema,
      responses: { 200: { description: "The document", schema: memoryDocumentSchema } },
      handler: async ({ serviceContext, params, query, body }) => {
        if (!query.teammate_context_id) {
          return updateMemoryDocument(serviceContext, params.document_id, body);
        }

        await requireTeammateMemory(serviceContext, query.teammate_context_id, params.document_id);

        return updateTeammateContextMemory(serviceContext, query.teammate_context_id, body);
      },
    })
    .delete({
      auth: true,
      summary: "Delete a memory document",
      paramSchema: documentParamsSchema,
      querySchema: scopeQuerySchema,
      handler: async ({ serviceContext, params, query }) => {
        await deleteMemoryDocument(serviceContext, params.document_id, query.project_id);

        return { deleted: true };
      },
    })
    .revisioned()
    .list({
      auth: true,
      summary: "List a memory document's revisions",
      paramSchema: documentParamsSchema,
      querySchema: scopeQuerySchema,
      responses: {
        200: { description: "Revisions", schema: memoryDocumentHistoryResponseSchema },
      },
      handler: async ({ serviceContext, params, query }) => {
        const history = await listMemoryDocumentRevisions(
          serviceContext,
          params.document_id,
          query.project_id,
        );

        return listPageOf(history.revisions, (revision) => revision.id);
      },
    });
});

export default app;
