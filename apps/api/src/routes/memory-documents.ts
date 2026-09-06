import {
  apiResponseSchema,
  createMemoryDocumentSchema,
  listMemoryDocumentsResponseSchema,
  memoryDocumentHistoryResponseSchema,
  memoryDocumentNameSchema,
  memoryDocumentSchema,
  updateMemoryDocumentSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/lib/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import {
  createMemoryDocument,
  deleteMemoryDocument,
  getMemoryDocument,
  listMemoryDocumentRevisions,
  listMemoryDocuments,
  updateMemoryDocument,
} from "~/services/memory-documents";

const app = new Hono();
const routeLogger = createRouteLogger("memory-documents");

app.use("/*", async (ctx, next) => {
  routeLogger.info(`Processing memory documents route: ${ctx.req.method} ${ctx.req.path}`);

  return next();
});

const scopeQuerySchema = z.object({ projectId: z.string().min(1).optional() });
const nameParamSchema = z.object({ name: memoryDocumentNameSchema });

addRoute(app, "get", "/", {
  tags: ["memory"],
  summary: "List memory documents",
  description: "List the memory documents in the caller's personal scope, or in a project.",
  auth: true,
  querySchema: scopeQuerySchema,
  responses: { 200: { description: "Documents", schema: listMemoryDocumentsResponseSchema } },
  handler: async ({ serviceContext, query }) =>
    listMemoryDocuments(serviceContext, query.projectId),
});

addRoute(app, "post", "/", {
  tags: ["memory"],
  summary: "Create a memory document",
  auth: true,
  bodySchema: createMemoryDocumentSchema,
  responses: { 200: { description: "Created document", schema: memoryDocumentSchema } },
  handler: async ({ serviceContext, body }) => createMemoryDocument(serviceContext, body),
});

addRoute(app, "get", "/:name", {
  tags: ["memory"],
  summary: "Read a memory document",
  auth: true,
  paramSchema: nameParamSchema,
  querySchema: scopeQuerySchema,
  responses: { 200: { description: "Document", schema: memoryDocumentSchema } },
  handler: async ({ serviceContext, params, query }) =>
    getMemoryDocument(serviceContext, params.name, query.projectId),
});

addRoute(app, "put", "/:name", {
  tags: ["memory"],
  summary: "Save a memory document",
  description: "Saves a new revision. The expected revision must match, so edits never overwrite.",
  auth: true,
  paramSchema: nameParamSchema,
  bodySchema: updateMemoryDocumentSchema,
  responses: { 200: { description: "Saved document", schema: memoryDocumentSchema } },
  handler: async ({ serviceContext, params, body }) =>
    updateMemoryDocument(serviceContext, params.name, body),
});

addRoute(app, "get", "/:name/revisions", {
  tags: ["memory"],
  summary: "List a memory document's revisions",
  auth: true,
  paramSchema: nameParamSchema,
  querySchema: scopeQuerySchema,
  responses: { 200: { description: "Revisions", schema: memoryDocumentHistoryResponseSchema } },
  handler: async ({ serviceContext, params, query }) =>
    listMemoryDocumentRevisions(serviceContext, params.name, query.projectId),
});

addRoute(app, "delete", "/:name", {
  tags: ["memory"],
  summary: "Delete a memory document",
  description: "Removes it from the list. Its revisions are kept.",
  auth: true,
  paramSchema: nameParamSchema,
  querySchema: scopeQuerySchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params, query }) => {
    await deleteMemoryDocument(serviceContext, params.name, query.projectId);

    return { success: true };
  },
});

export default app;
