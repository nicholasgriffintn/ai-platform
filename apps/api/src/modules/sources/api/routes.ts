import {
  addCollectionSourcesSchema,
  createSourceSyncSchema,
  sourceSyncListSchema,
  knowledgeSearchSchema,
  knowledgeSearchResponseSchema,
  knowledgeStatusResponseSchema,
  createSourceCollectionSchema,
  createSourceSchema,
  sourceCollectionListResponseSchema,
  sourceCollectionSchema,
  sourceDetailListResponseSchema,
  sourceListQuerySchema,
  sourceListResponseSchema,
  sourceSchema,
  setProjectContextSourcesSchema,
  updateSourceSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { getPrivateFileResponse, readPrivateFile } from "~/infrastructure/storage/read-resource";
import { retrySourceIndex } from "~/modules/sources/application/knowledge-indexing";
import {
  listKnowledgeStatus,
  searchKnowledge,
} from "~/modules/sources/application/knowledge-search";
import {
  createSourceSync,
  listSourceSyncs,
  updateSourceSync,
  deleteSourceSync,
} from "~/modules/sources/application/source-sync";
import {
  addCollectionSources,
  createSource,
  createSourceCollection,
  deleteSource,
  deleteSourceCollection,
  getSource,
  listCollectionSources,
  listProjectContextSources,
  listProjectConversationSources,
  listSourceCollections,
  listSources,
  setProjectContextSources,
  updateSource,
} from "~/modules/sources/application/sources";

const app = new Hono();
const sourceParams = z.object({ sourceId: z.string().min(1) });
const collectionParams = z.object({ collectionId: z.string().min(1) });
const projectQuery = z.object({ projectId: z.string().min(1).optional() });
const requiredProjectQuery = z.object({ projectId: z.string().min(1) });
const createSourceRequestSchema = createSourceSchema.omit({ file: true });
const syncParams = z.object({ syncId: z.string().min(1) });

addRoute(app, "get", "/syncs", {
  tags: ["sources"],
  auth: true,
  querySchema: projectQuery,
  responses: { 200: { description: "Source syncs", schema: sourceSyncListSchema } },
  handler: ({ query, serviceContext }) => listSourceSyncs(serviceContext, query.projectId),
});

addRoute(app, "post", "/syncs", {
  tags: ["sources"],
  auth: true,
  bodySchema: createSourceSyncSchema,
  responses: { 200: { description: "Created source sync", schema: sourceSyncListSchema } },
  handler: ({ body, serviceContext }) => createSourceSync(serviceContext, body),
});

addRoute(app, "put", "/syncs/:syncId", {
  tags: ["sources"],
  auth: true,
  paramSchema: syncParams,
  bodySchema: z.object({ enabled: z.boolean() }).strict(),
  responses: { 200: { description: "Updated source sync", schema: sourceSyncListSchema } },
  handler: ({ params, body, serviceContext }) =>
    updateSourceSync(serviceContext, params.syncId, body.enabled),
});

addRoute(app, "delete", "/syncs/:syncId", {
  tags: ["sources"],
  auth: true,
  paramSchema: syncParams,
  responses: {
    200: { description: "Deleted source sync", schema: z.object({ deleted: z.literal(true) }) },
  },
  handler: ({ params, serviceContext }) => deleteSourceSync(serviceContext, params.syncId),
});

addRoute(app, "post", "/search", {
  tags: ["sources"],
  auth: true,
  bodySchema: knowledgeSearchSchema,
  responses: {
    200: { description: "Authorised knowledge passages", schema: knowledgeSearchResponseSchema },
  },
  handler: ({ body, serviceContext }) => searchKnowledge(serviceContext, body),
});

addRoute(app, "get", "/index-status", {
  tags: ["sources"],
  auth: true,
  querySchema: projectQuery,
  responses: {
    200: { description: "Knowledge indexing status", schema: knowledgeStatusResponseSchema },
  },
  handler: ({ query, serviceContext }) => listKnowledgeStatus(serviceContext, query.projectId),
});

addRoute(app, "post", "/:sourceId/reindex", {
  tags: ["sources"],
  auth: true,
  paramSchema: sourceParams,
  responses: {
    200: { description: "Indexing queued", schema: z.object({ queued: z.literal(true) }) },
  },
  handler: ({ params, serviceContext }) => retrySourceIndex(serviceContext, params.sourceId),
});

addRoute(app, "get", "/:sourceId/content", {
  tags: ["sources"],
  paramSchema: sourceParams,
  responses: { 200: { description: "Source file" } },
  handler: async ({ params, serviceContext, user }) => {
    const file = await readPrivateFile({
      context: serviceContext,
      kind: "source",
      resourceId: params.sourceId,
      userId: user?.id,
    });

    return await getPrivateFileResponse(file.record, file.object);
  },
});

addRoute(app, "get", "/", {
  tags: ["sources"],
  auth: true,
  querySchema: sourceListQuerySchema,
  responses: { 200: { description: "Sources", schema: sourceListResponseSchema } },
  handler: ({ query, serviceContext, user }) => listSources(serviceContext, user.id, query),
});

addRoute(app, "post", "/", {
  tags: ["sources"],
  auth: true,
  bodySchema: createSourceRequestSchema,
  responses: { 200: { description: "Created source", schema: sourceSchema } },
  handler: ({ body, serviceContext, user }) => createSource(serviceContext, user.id, body),
});

addRoute(app, "get", "/collections", {
  tags: ["sources"],
  auth: true,
  querySchema: projectQuery,
  responses: {
    200: { description: "Source collections", schema: sourceCollectionListResponseSchema },
  },
  handler: ({ query, serviceContext, user }) =>
    listSourceCollections(serviceContext, user.id, query.projectId),
});

addRoute(app, "post", "/collections", {
  tags: ["sources"],
  auth: true,
  bodySchema: createSourceCollectionSchema,
  responses: { 200: { description: "Created collection", schema: sourceCollectionSchema } },
  handler: ({ body, serviceContext, user }) =>
    createSourceCollection(serviceContext, user.id, body),
});

addRoute(app, "get", "/collections/:collectionId/sources", {
  tags: ["sources"],
  auth: true,
  paramSchema: collectionParams,
  responses: { 200: { description: "Collection sources", schema: sourceListResponseSchema } },
  handler: ({ params, serviceContext, user }) =>
    listCollectionSources(serviceContext, user.id, params.collectionId),
});

addRoute(app, "post", "/collections/:collectionId/sources", {
  tags: ["sources"],
  auth: true,
  paramSchema: collectionParams,
  bodySchema: addCollectionSourcesSchema,
  responses: {
    200: {
      description: "Sources added",
      schema: z.object({ added: z.number().int().nonnegative() }),
    },
  },
  handler: ({ body, params, serviceContext, user }) =>
    addCollectionSources(serviceContext, user.id, params.collectionId, body.sourceIds),
});

addRoute(app, "get", "/project-context", {
  tags: ["sources"],
  auth: true,
  querySchema: requiredProjectQuery,
  responses: { 200: { description: "Project context sources", schema: sourceListResponseSchema } },
  handler: ({ query, serviceContext, user }) =>
    listProjectContextSources(serviceContext, user.id, query.projectId),
});

addRoute(app, "get", "/project-conversation", {
  tags: ["sources"],
  auth: true,
  querySchema: requiredProjectQuery,
  responses: {
    200: { description: "Project conversation sources", schema: sourceDetailListResponseSchema },
  },
  handler: ({ query, serviceContext, user }) =>
    listProjectConversationSources(serviceContext, user.id, query.projectId),
});

addRoute(app, "put", "/project-context", {
  tags: ["sources"],
  auth: true,
  querySchema: requiredProjectQuery,
  bodySchema: setProjectContextSourcesSchema,
  responses: { 200: { description: "Project context sources", schema: sourceListResponseSchema } },
  handler: ({ body, query, serviceContext, user }) =>
    setProjectContextSources(serviceContext, user.id, query.projectId, body.sourceIds),
});

addRoute(app, "delete", "/collections/:collectionId", {
  tags: ["sources"],
  auth: true,
  paramSchema: collectionParams,
  responses: {
    200: { description: "Deleted collection", schema: z.object({ success: z.literal(true) }) },
  },
  handler: async ({ params, serviceContext, user }) => {
    await deleteSourceCollection(serviceContext, user.id, params.collectionId);

    return { success: true as const };
  },
});

addRoute(app, "get", "/:sourceId", {
  tags: ["sources"],
  auth: true,
  paramSchema: sourceParams,
  responses: { 200: { description: "Source", schema: sourceSchema } },
  handler: ({ params, serviceContext, user }) =>
    getSource(serviceContext, user.id, params.sourceId),
});

addRoute(app, "put", "/:sourceId", {
  tags: ["sources"],
  auth: true,
  paramSchema: sourceParams,
  bodySchema: updateSourceSchema,
  responses: { 200: { description: "Updated source", schema: sourceSchema } },
  handler: ({ body, params, serviceContext, user }) =>
    updateSource(serviceContext, user.id, params.sourceId, body),
});

addRoute(app, "delete", "/:sourceId", {
  tags: ["sources"],
  auth: true,
  paramSchema: sourceParams,
  responses: {
    200: { description: "Deleted source", schema: z.object({ success: z.literal(true) }) },
  },
  handler: async ({ params, serviceContext, user }) => {
    await deleteSource(serviceContext, user.id, params.sourceId);

    return { success: true as const };
  },
});

export default app;
