import {
  addCollectionSourcesSchema,
  createSourceCoverSchema,
  drawingSchema,
  enablePodcastFeedResponseSchema,
  generatePodcastSchema,
  generateSourceMediaSchema,
  guessDrawingSchema,
  listPageOf,
  sourceGenerationRejectionSchema,
  summariseSourceSchema,
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
import { startSourceGeneration } from "~/modules/sources/application/generation";
import { paintDrawing } from "~/modules/sources/application/generation/drawing/create";
import { guessDrawingFromImage } from "~/modules/sources/application/generation/drawing/guess";
import { listReplicateModels } from "~/modules/sources/application/generation/replicate-models";
import { listCanvasModels } from "~/modules/sources/application/generation/studio/list-models";
import { searchProjectKnowledge } from "~/modules/sources/application/knowledge-search";
import {
  controlKnowledgeSync,
  createKnowledgeSync,
  listKnowledgeSyncs,
} from "~/modules/sources/application/knowledge-sync";
import {
  createSourceCover,
  readSourceCoverObject,
} from "~/modules/sources/application/media/cover";
import { summariseSource } from "~/modules/sources/application/media/notes";
import { startSourceTranscription } from "~/modules/sources/application/media/transcribe";
import {
  disablePodcastFeed,
  enablePodcastFeed,
  readPodcastFeed,
  readPodcastFeedFile,
} from "~/modules/sources/application/podcasts/feed";
import { startPodcastGeneration } from "~/modules/sources/application/podcasts/generate";
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
  requireSourceAccess,
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
const feedParamsSchema = z.object({ token: z.string().min(32) });
const feedFileParamsSchema = feedParamsSchema.extend({ source_id: z.string().min(1) });
const studioModelsQuerySchema = z.object({ mode: z.enum(["image", "video"]).default("image") });
const startedGenerationsSchema = z.object({
  sources: z.array(sourceSchema),
  rejected: z.array(sourceGenerationRejectionSchema),
});

function publicBaseUrl(env: { API_BASE_URL?: string }, requestUrl: string): string {
  return env.API_BASE_URL || new URL(requestUrl).origin;
}

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
          generation: query.generation,
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

  sources
    .action("transcribe", {
      auth: true,
      summary: "Transcribe an audio or video source",
      description:
        "Queues a transcript. The source's media metadata reports progress, and the transcript becomes its searchable content.",
      paramSchema: sourceParamsSchema,
      responses: { 200: { description: "The source", schema: sourceSchema } },
      handler: ({ params, serviceContext, user }) =>
        startSourceTranscription(serviceContext, user.id, params.source_id),
    })
    .action("notes", {
      auth: true,
      summary: "Write notes for a transcribed source",
      description: "Summarises the transcript into a summary, decisions and action items.",
      paramSchema: sourceParamsSchema,
      bodySchema: summariseSourceSchema,
      responses: { 200: { description: "The source", schema: sourceSchema } },
      handler: ({ body, params, serviceContext }) =>
        summariseSource(serviceContext, params.source_id, body),
    })
    .action("cover", {
      auth: true,
      summary: "Generate cover art for a source",
      paramSchema: sourceParamsSchema,
      bodySchema: createSourceCoverSchema,
      responses: { 200: { description: "The source", schema: sourceSchema } },
      handler: ({ body, params, serviceContext }) =>
        createSourceCover(serviceContext, params.source_id, body),
    })
    .collectionAction("podcasts", {
      auth: true,
      summary: "Generate a podcast episode from sources",
      description:
        "Creates a podcast source that stays processing while two hosts' conversation is written and voiced.",
      bodySchema: generatePodcastSchema,
      responses: { 200: { description: "The episode", schema: sourceSchema } },
      handler: ({ body, serviceContext }) => startPodcastGeneration(serviceContext, body),
    });

  sources.singleton("cover").read({
    auth: true,
    summary: "Download a source's cover art",
    paramSchema: sourceParamsSchema,
    responses: { 200: { description: "Cover image" } },
    handler: async ({ params, serviceContext, user }) =>
      readSourceCoverObject(
        serviceContext,
        await requireSourceAccess(serviceContext, user.id, params.source_id),
      ),
  });

  const generations = sources.collection("generations", "generation_id");

  generations.create({
    auth: true,
    summary: "Generate images, video or model output into Sources",
    description:
      "type=studio runs one prompt across several image or video models; type=model runs one model with its own inputs. Each run is a source that stays processing until its media arrives.",
    bodySchema: generateSourceMediaSchema,
    responses: { 200: { description: "Started generations", schema: startedGenerationsSchema } },
    handler: ({ body, serviceContext }) => startSourceGeneration(serviceContext, body),
  });

  generations.collection("models", "model_id").list({
    auth: "user-or-anonymous",
    summary: "List image and video generation models",
    querySchema: studioModelsQuerySchema,
    handler: async ({ query, serviceContext, user }) =>
      listPageOf(
        await listCanvasModels({ env: serviceContext.env, mode: query.mode, userId: user?.id }),
        (model) => model.id,
      ),
  });

  generations.collection("replicate_models", "model_id").list({
    auth: "user-or-anonymous",
    summary: "List Replicate models",
    handler: async () => listPageOf(listReplicateModels(), (model) => model.id),
  });

  sources
    .collection("drawings", "drawing_id")
    .create({
      auth: true,
      summary: "Paint a sketch into an image source",
      description: "Keeps the sketch and the painting as image sources.",
      querySchema: projectQuerySchema,
      formSchema: drawingSchema,
      responses: { 200: { description: "The painting", schema: sourceSchema } },
      handler: async ({ query, raw, serviceContext }) =>
        paintDrawing(
          serviceContext,
          drawingSchema.parse(await raw.req.parseBody()).drawing,
          query.project_id,
        ),
    })
    .collectionAction("guess", {
      auth: true,
      summary: "Guess what a sketch shows",
      querySchema: projectQuerySchema,
      formSchema: guessDrawingSchema,
      responses: {
        200: { description: "The guess", schema: z.object({ guess: z.string() }) },
      },
      handler: async ({ query, raw, serviceContext }) =>
        guessDrawingFromImage(
          serviceContext,
          guessDrawingSchema.parse(await raw.req.parseBody()).drawing,
          query.project_id,
        ),
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
    .action("feed", {
      auth: true,
      summary: "Create a private RSS feed link for a podcast show",
      description:
        "Returns a new feed URL for podcast apps. Any earlier link for the show stops working.",
      paramSchema: collectionParamsSchema,
      responses: {
        200: { description: "The feed link", schema: enablePodcastFeedResponseSchema },
      },
      handler: ({ params, raw, serviceContext, user }) =>
        enablePodcastFeed(
          serviceContext,
          user.id,
          params.collection_id,
          publicBaseUrl(serviceContext.env, raw.req.url),
        ),
    })
    .shared({
      auth: false,
      summary: "Read a podcast show's RSS feed",
      paramSchema: feedParamsSchema,
      responses: { 200: { description: "RSS feed" } },
      handler: ({ params, raw, serviceContext }) =>
        readPodcastFeed(
          serviceContext,
          params.token,
          publicBaseUrl(serviceContext.env, raw.req.url),
        ),
    })
    .shared(
      {
        auth: false,
        summary: "Download a podcast episode from its feed",
        paramSchema: feedFileParamsSchema,
        responses: { 200: { description: "Episode audio" } },
        handler: ({ params, serviceContext }) =>
          readPodcastFeedFile(serviceContext, params.token, params.source_id, "audio"),
      },
      ":source_id",
    )
    .shared(
      {
        auth: false,
        summary: "Download a podcast episode's cover art from its feed",
        paramSchema: feedFileParamsSchema,
        responses: { 200: { description: "Cover image" } },
        handler: ({ params, serviceContext }) =>
          readPodcastFeedFile(serviceContext, params.token, params.source_id, "cover"),
      },
      ":source_id/cover",
    );

  collections.singleton("feed").delete({
    auth: true,
    summary: "Turn off a podcast show's RSS feed",
    paramSchema: collectionParamsSchema,
    handler: async ({ params, serviceContext, user }) => {
      await disablePodcastFeed(serviceContext, user.id, params.collection_id);

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
