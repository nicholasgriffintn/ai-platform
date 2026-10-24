import {
  createNotebookNoteSchema,
  createNotebookSchema,
  linkNotebookSourcesSchema,
  notebookDetailSchema,
  notebookListQuerySchema,
  notebookListResponseSchema,
  notebookParamsSchema,
  notebookResearchResponseSchema,
  notebookResearchSchema,
  notebookSchema,
  notebookSourceParamsSchema,
  notebookStudioRequestSchema,
  notebookStudioResponseSchema,
  sourceSummarySchema,
  studyProgressSchema,
  updateNotebookSchema,
  VIDEO_OVERVIEW_MAX_SCENES,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import {
  createNotebook,
  createNotebookNote,
  deleteNotebook,
  getNotebookDetail,
  linkNotebookSources,
  listNotebooks,
  promoteNotebookNote,
  unlinkNotebookSource,
  updateNotebook,
} from "~/modules/notebooks/application/notebooks";
import {
  importNotebookResearch,
  researchForNotebook,
} from "~/modules/notebooks/application/research";
import { startNotebookStudio } from "~/modules/notebooks/application/studio/start";
import {
  getStudyProgress,
  readVideoSceneImage,
  saveStudyProgress,
} from "~/modules/notebooks/application/study";

const app = new Hono();
const noteParamsSchema = notebookParamsSchema.extend({ note_id: z.string().min(1) }).strict();
const outputParamsSchema = notebookParamsSchema.extend({ output_id: z.string().min(1) }).strict();
const sceneParamsSchema = outputParamsSchema
  .extend({
    scene_index: z.coerce
      .number()
      .int()
      .min(0)
      .max(VIDEO_OVERVIEW_MAX_SCENES - 1),
  })
  .strict();

defineResource(app, { idParam: "notebook_id", tags: ["notebooks"] }, (notebooks) => {
  notebooks
    .list({
      auth: true,
      summary: "List notebooks",
      description: "Personal notebooks, or a project's when project_id is set.",
      querySchema: notebookListQuerySchema,
      responses: { 200: { description: "Notebooks", schema: notebookListResponseSchema } },
      handler: ({ query, serviceContext }) => listNotebooks(serviceContext, query.project_id),
    })
    .create({
      auth: true,
      summary: "Create a notebook",
      description:
        "A notebook groups conversations with the sources, notes and studio outputs they share.",
      bodySchema: createNotebookSchema,
      responses: {
        200: { description: "The notebook", schema: notebookSchema },
        409: { description: "A notebook with the same name already exists" },
      },
      handler: ({ body, serviceContext }) => createNotebook(serviceContext, body),
    })
    .read({
      auth: true,
      summary: "Read a notebook",
      paramSchema: notebookParamsSchema,
      responses: { 200: { description: "The notebook", schema: notebookDetailSchema } },
      handler: ({ params, serviceContext }) =>
        getNotebookDetail(serviceContext, params.notebook_id),
    })
    .update({
      auth: true,
      summary: "Update a notebook",
      description: "Renames the notebook or changes its instructions and chat settings.",
      paramSchema: notebookParamsSchema,
      bodySchema: updateNotebookSchema,
      responses: {
        200: { description: "The notebook", schema: notebookSchema },
        409: { description: "A notebook with the same name already exists" },
      },
      handler: ({ body, params, serviceContext }) =>
        updateNotebook(serviceContext, params.notebook_id, body),
    })
    .delete({
      auth: true,
      summary: "Delete a notebook",
      description:
        "Removes the notebook. Its conversations, sources and outputs stay where they are.",
      paramSchema: notebookParamsSchema,
      handler: async ({ params, serviceContext }) => {
        await deleteNotebook(serviceContext, params.notebook_id);

        return { deleted: true };
      },
    })
    .action("research", {
      auth: true,
      summary: "Research the web for a notebook",
      description:
        "depth=fast returns pages to import. depth=deep adds a report source that stays processing while the research runs, then imports the pages it cites.",
      paramSchema: notebookParamsSchema,
      bodySchema: notebookResearchSchema,
      responses: { 200: { description: "Research", schema: notebookResearchResponseSchema } },
      handler: ({ body, params, serviceContext }) =>
        researchForNotebook(serviceContext, params.notebook_id, body),
    })
    .action("studio", {
      auth: true,
      summary: "Make something from a notebook's sources",
      description:
        "Audio overviews and infographics become sources; every other kind becomes an output that stays pending until it is written.",
      paramSchema: notebookParamsSchema,
      bodySchema: notebookStudioRequestSchema,
      responses: { 200: { description: "The started item", schema: notebookStudioResponseSchema } },
      handler: ({ body, params, serviceContext }) =>
        startNotebookStudio(serviceContext, params.notebook_id, body),
    });

  notebooks
    .sub("sources", "source_id")
    .create({
      auth: true,
      summary: "Add sources to a notebook",
      description: "Links existing sources by id, or reads web pages into new sources.",
      paramSchema: notebookParamsSchema,
      bodySchema: linkNotebookSourcesSchema,
      responses: { 200: { description: "The notebook", schema: notebookDetailSchema } },
      handler: ({ body, params, serviceContext }) =>
        "sourceIds" in body
          ? linkNotebookSources(serviceContext, params.notebook_id, body.sourceIds)
          : importNotebookResearch(serviceContext, params.notebook_id, body),
    })
    .delete({
      auth: true,
      summary: "Remove a source from a notebook",
      description: "Unlinks the source. The source itself stays in Files.",
      paramSchema: notebookSourceParamsSchema,
      responses: { 200: { description: "The notebook", schema: notebookDetailSchema } },
      handler: ({ params, serviceContext }) =>
        unlinkNotebookSource(serviceContext, params.notebook_id, params.source_id),
    });

  notebooks
    .sub("notes", "note_id")
    .create({
      auth: true,
      summary: "Add a note to a notebook",
      paramSchema: notebookParamsSchema,
      bodySchema: createNotebookNoteSchema,
      responses: { 200: { description: "The note", schema: sourceSummarySchema } },
      handler: ({ body, params, serviceContext }) =>
        createNotebookNote(serviceContext, params.notebook_id, body),
    })
    .action("promote", {
      auth: true,
      summary: "Turn a note into a source",
      paramSchema: noteParamsSchema,
      responses: { 200: { description: "The notebook", schema: notebookDetailSchema } },
      handler: ({ params, serviceContext }) =>
        promoteNotebookNote(serviceContext, params.notebook_id, params.note_id),
    });

  notebooks
    .sub("outputs", "output_id")
    .sub("scenes", "scene_index")
    .read({
      auth: true,
      summary: "Download a video overview scene's illustration",
      paramSchema: sceneParamsSchema,
      responses: { 200: { description: "Scene image" } },
      handler: ({ params, raw, serviceContext }) =>
        readVideoSceneImage(
          serviceContext,
          params.notebook_id,
          params.output_id,
          params.scene_index,
          raw.req.header("range"),
        ),
    });

  notebooks
    .sub("outputs", "output_id")
    .singleton("progress")
    .read({
      auth: true,
      summary: "Read your study progress on a notebook output",
      paramSchema: outputParamsSchema,
      responses: { 200: { description: "Study progress", schema: studyProgressSchema } },
      handler: ({ params, serviceContext }) =>
        getStudyProgress(serviceContext, params.notebook_id, params.output_id),
    })
    .update({
      auth: true,
      summary: "Save your study progress on a notebook output",
      paramSchema: outputParamsSchema,
      bodySchema: studyProgressSchema,
      responses: { 200: { description: "Study progress", schema: studyProgressSchema } },
      handler: ({ body, params, serviceContext }) =>
        saveStudyProgress(serviceContext, params.notebook_id, params.output_id, body),
    });
});

export default app;
