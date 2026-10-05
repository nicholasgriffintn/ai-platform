import {
  createKnowledgeSyncSchema,
  knowledgeSearchSchema,
  knowledgeSearchResponseSchema,
  knowledgeSyncControlSchema,
  knowledgeSyncListSchema,
  knowledgeSyncParamsSchema,
  knowledgeSyncSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import {
  controlKnowledgeSync,
  createKnowledgeSync,
  deleteKnowledgeSync,
  listKnowledgeSyncs,
} from "~/modules/sources/application/knowledge/connections";
import { searchKnowledge } from "~/modules/sources/application/knowledge/search";

const app = new Hono();
const tags = ["sources"];

addRoute(app, "get", "/", {
  tags,
  auth: true,
  querySchema: z.object({ projectId: z.string().min(1).optional() }).strict(),
  responses: { 200: { description: "Knowledge connections", schema: knowledgeSyncListSchema } },
  handler: ({ serviceContext, query }) => listKnowledgeSyncs(serviceContext, query.projectId),
});

addRoute(app, "post", "/", {
  tags,
  auth: true,
  bodySchema: createKnowledgeSyncSchema,
  responses: { 200: { description: "Knowledge connection", schema: knowledgeSyncSchema } },
  handler: ({ serviceContext, body }) => createKnowledgeSync(serviceContext, body),
});

addRoute(app, "post", "/search", {
  tags,
  auth: true,
  bodySchema: knowledgeSearchSchema,
  responses: {
    200: { description: "Accessible knowledge", schema: knowledgeSearchResponseSchema },
  },
  handler: ({ serviceContext, body }) => searchKnowledge(serviceContext, body),
});

addRoute(app, "patch", "/:syncId", {
  tags,
  auth: true,
  paramSchema: knowledgeSyncParamsSchema,
  bodySchema: knowledgeSyncControlSchema,
  responses: { 200: { description: "Updated knowledge connection", schema: knowledgeSyncSchema } },
  handler: ({ serviceContext, params, body }) =>
    controlKnowledgeSync(serviceContext, params.syncId, body),
});

addRoute(app, "delete", "/:syncId", {
  tags,
  auth: true,
  paramSchema: knowledgeSyncParamsSchema,
  responses: {
    200: { description: "Disconnected knowledge", schema: z.object({ success: z.literal(true) }) },
  },
  handler: async ({ serviceContext, params }) => {
    await deleteKnowledgeSync(serviceContext, params.syncId);

    return { success: true as const };
  },
});

export default app;
