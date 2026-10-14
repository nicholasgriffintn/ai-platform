import {
  addCollectionSourcesSchema,
  createKnowledgeSyncSchema,
  createSourceCollectionSchema,
  createSourceSchema,
  knowledgeSyncListSchema,
  knowledgeSyncSchema,
  projectKnowledgeSearchResponseSchema,
  setProjectContextSourcesSchema,
  sourceCollectionListResponseSchema,
  sourceCollectionSchema,
  sourceListQuerySchema,
  sourceListResponseSchema,
  sourceSchema,
  knowledgeSearchQuerySchema,
  updateKnowledgeSyncSchema,
  updateSourceSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource, defineSingleton } from "~/infrastructure/http/resource";
import { getPrivateFileResponse, readPrivateFile } from "~/infrastructure/storage/read-resource";
import { searchProjectKnowledge } from "~/modules/sources/application/knowledge-search";
import {
  controlKnowledgeSync,
  createKnowledgeSync,
  listKnowledgeSyncs,
} from "~/modules/sources/application/knowledge-sync";
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
const sourceParamsSchema = z.object({ source_id: z.string().min(1) });
const collectionParamsSchema = z.object({ collection_id: z.string().min(1) });
const syncParamsSchema = z.object({ sync_id: z.string().min(1) });
const projectQuerySchema = z.object({ project_id: z.string().min(1).optional() });
const requiredProjectQuerySchema = z.object({ project_id: z.string().min(1) });
const createSourceRequestSchema = createSourceSchema.omit({ file: true });

defineSingleton(app, { path: "/project_context", tags: ["sources"] }, (projectContext) => {
  projectContext.update({
    auth: true,
    summary: "Set a project's context sources",
    bodySchema: setProjectContextSourcesSchema,
    responses: { 200: { description: "Context sources", schema: sourceListResponseSchema } },
    handler: ({ body, serviceContext, user }) =>
      setProjectContextSources(serviceContext, user.id, body.project_id, body.sourceIds),
  });
});

defineResource(app, { idParam: "source_id", tags: ["sources"] }, (sources) => {
  sources
    .list({
      auth: true,
      summary: "List sources",
      description:
        "Personal sources, or a project's when project_id is set. scope=context lists the project's context collection; scope=conversation lists the available context sources in full, as conversations read them.",
      querySchema: sourceListQuerySchema,
      responses: { 200: { description: "Sources", schema: sourceListResponseSchema } },
      handler: ({ query, serviceContext, user }) => {
        if (query.scope === "context" && query.project_id) {
          return listProjectContextSources(serviceContext, user.id, query.project_id);
        }

        if (query.scope === "conversation" && query.project_id) {
          return listProjectConversationSources(serviceContext, user.id, query.project_id);
        }

        return listSources(serviceContext, user.id, {
          projectId: query.project_id,
          kind: query.kind,
        });
      },
    })
    .create({
      auth: true,
      summary: "Create a source",
      bodySchema: createSourceRequestSchema,
      responses: { 200: { description: "The source", schema: sourceSchema } },
      handler: ({ body, serviceContext, user }) => createSource(serviceContext, user.id, body),
    })
    .view("search", {
      auth: true,
      summary: "Search project knowledge",
      querySchema: knowledgeSearchQuerySchema,
      responses: {
        200: { description: "Passages", schema: projectKnowledgeSearchResponseSchema },
      },
      handler: ({ query: { project_id, ...query }, serviceContext }) =>
        searchProjectKnowledge(serviceContext, { ...query, projectId: project_id }),
    })
    .read({
      auth: true,
      summary: "Read a source",
      paramSchema: sourceParamsSchema,
      responses: { 200: { description: "The source", schema: sourceSchema } },
      handler: ({ params, serviceContext, user }) =>
        getSource(serviceContext, user.id, params.source_id),
    })
    .update({
      auth: true,
      summary: "Update a source",
      paramSchema: sourceParamsSchema,
      bodySchema: updateSourceSchema,
      responses: { 200: { description: "The source", schema: sourceSchema } },
      handler: ({ body, params, serviceContext, user }) =>
        updateSource(serviceContext, user.id, params.source_id, body),
    })
    .delete({
      auth: true,
      summary: "Delete a source",
      paramSchema: sourceParamsSchema,
      handler: async ({ params, serviceContext, user }) => {
        await deleteSource(serviceContext, user.id, params.source_id);

        return { deleted: true };
      },
    });

  sources.singleton("content").read({
    auth: "user-or-anonymous",
    summary: "Download a source's file",
    paramSchema: sourceParamsSchema,
    responses: { 200: { description: "Source file" } },
    handler: async ({ params, serviceContext, user }) => {
      const file = await readPrivateFile({
        context: serviceContext,
        kind: "source",
        resourceId: params.source_id,
        userId: user?.id,
      });

      return getPrivateFileResponse(file.record, file.object);
    },
  });

  const collections = sources.collection("collections", "collection_id");

  collections
    .list({
      auth: true,
      summary: "List source collections",
      querySchema: projectQuerySchema,
      responses: {
        200: { description: "Collections", schema: sourceCollectionListResponseSchema },
      },
      handler: ({ query, serviceContext, user }) =>
        listSourceCollections(serviceContext, user.id, query.project_id),
    })
    .create({
      auth: true,
      summary: "Create a source collection",
      bodySchema: createSourceCollectionSchema,
      responses: { 200: { description: "The collection", schema: sourceCollectionSchema } },
      handler: ({ body, serviceContext, user }) =>
        createSourceCollection(serviceContext, user.id, body),
    })
    .delete({
      auth: true,
      summary: "Delete a source collection",
      paramSchema: collectionParamsSchema,
      handler: async ({ params, serviceContext, user }) => {
        await deleteSourceCollection(serviceContext, user.id, params.collection_id);

        return { deleted: true };
      },
    });

  collections
    .sub("sources", "source_id")
    .list({
      auth: true,
      summary: "List a collection's sources",
      paramSchema: collectionParamsSchema,
      responses: { 200: { description: "Sources", schema: sourceListResponseSchema } },
      handler: ({ params, serviceContext, user }) =>
        listCollectionSources(serviceContext, user.id, params.collection_id),
    })
    .create({
      auth: true,
      summary: "Add sources to a collection",
      paramSchema: collectionParamsSchema,
      bodySchema: addCollectionSourcesSchema,
      responses: {
        200: {
          description: "Sources added",
          schema: z.object({ added: z.number().int().nonnegative() }),
        },
      },
      handler: ({ body, params, serviceContext, user }) =>
        addCollectionSources(serviceContext, user.id, params.collection_id, body.sourceIds),
    });

  sources
    .collection("knowledge_syncs", "sync_id")
    .list({
      auth: true,
      summary: "List a project's knowledge syncs",
      querySchema: requiredProjectQuerySchema,
      responses: { 200: { description: "Knowledge syncs", schema: knowledgeSyncListSchema } },
      handler: ({ query, serviceContext }) => listKnowledgeSyncs(serviceContext, query.project_id),
    })
    .create({
      auth: true,
      summary: "Start a knowledge sync",
      bodySchema: createKnowledgeSyncSchema,
      responses: { 200: { description: "The sync", schema: knowledgeSyncSchema } },
      handler: ({ body, serviceContext }) => createKnowledgeSync(serviceContext, body),
    })
    .update({
      auth: true,
      summary: "Pause, resume or refresh a knowledge sync",
      paramSchema: syncParamsSchema,
      bodySchema: updateKnowledgeSyncSchema,
      responses: { 200: { description: "The sync", schema: knowledgeSyncSchema } },
      handler: ({ params, body, serviceContext }) =>
        controlKnowledgeSync(serviceContext, params.sync_id, body),
    });
});

export default app;
