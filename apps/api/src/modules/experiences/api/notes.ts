import {
  errorResponseSchema,
  generateNotesFromMediaResponseSchema,
  generateNotesFromMediaSchema,
  listPageOf,
  noteCreateSchema,
  noteDetailResponseSchema,
  noteFormatResponseSchema,
  noteFormatSchema,
  noteListQuerySchema,
  noteUpdateSchema,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import type { HonoLike } from "~/infrastructure/http/routeBuilder";
import { generateDocumentFromMedia } from "~/modules/documents/application";
import {
  createNote,
  deleteNote,
  formatNote,
  getNote,
  listNotes,
  updateNote,
} from "~/modules/experiences/application/notes/list";
import { projectScopeQuerySchema } from "~/modules/workspaces/application/access";

import { proExperience } from "./access";

const noteParamsSchema = z.object({ note_id: z.string().min(1) });
const access = proExperience("featured-note-taker");

export function defineNotes(app: HonoLike): void {
  defineResource(app, { path: "/notes", idParam: "note_id", tags: ["experiences"] }, (notes) => {
    notes
      .list({
        auth: true,
        summary: "List notes",
        middleware: access,
        querySchema: projectScopeQuerySchema.extend(noteListQuerySchema.shape),
        handler: async ({ query, serviceContext, user }) =>
          listPageOf(
            await listNotes({
              context: serviceContext,
              userId: user.id,
              projectId: query.project_id,
              query: query.q,
            }),
            (note) => note.id,
          ),
      })
      .create({
        auth: true,
        summary: "Create a note",
        middleware: access,
        querySchema: projectScopeQuerySchema,
        bodySchema: noteCreateSchema,
        responses: { 200: { description: "The note", schema: noteDetailResponseSchema } },
        handler: async ({ body, query, serviceContext, user }) => ({
          note: await createNote({
            context: serviceContext,
            env: serviceContext.env,
            user,
            data: body,
            projectId: query.project_id,
          }),
        }),
      })
      .read({
        auth: true,
        summary: "Get a note",
        middleware: access,
        paramSchema: noteParamsSchema,
        querySchema: projectScopeQuerySchema,
        responses: {
          200: { description: "The note", schema: noteDetailResponseSchema },
          404: { description: "Note not found", schema: errorResponseSchema },
        },
        handler: async ({ params, query, serviceContext, user }) => ({
          note: await getNote({
            context: serviceContext,
            userId: user.id,
            noteId: params.note_id,
            projectId: query.project_id,
          }),
        }),
      })
      .update({
        auth: true,
        summary: "Update a note",
        middleware: access,
        paramSchema: noteParamsSchema,
        querySchema: projectScopeQuerySchema,
        bodySchema: noteUpdateSchema,
        responses: { 200: { description: "The note", schema: noteDetailResponseSchema } },
        handler: async ({ body, params, query, serviceContext, user }) => ({
          note: await updateNote({
            context: serviceContext,
            env: serviceContext.env,
            user,
            noteId: params.note_id,
            data: body,
            projectId: query.project_id,
          }),
        }),
      })
      .delete({
        auth: true,
        summary: "Delete a note",
        middleware: access,
        paramSchema: noteParamsSchema,
        querySchema: projectScopeQuerySchema,
        handler: async ({ params, query, serviceContext, user }) => {
          await deleteNote({
            context: serviceContext,
            env: serviceContext.env,
            user,
            noteId: params.note_id,
            projectId: query.project_id,
          });

          return { deleted: true };
        },
      })
      .action("format", {
        auth: true,
        summary: "Format a note",
        middleware: access,
        paramSchema: noteParamsSchema,
        querySchema: projectScopeQuerySchema,
        bodySchema: noteFormatSchema,
        responses: { 200: { description: "Formatted content", schema: noteFormatResponseSchema } },
        handler: ({ body, params, query, serviceContext, user }) =>
          formatNote({
            context: serviceContext,
            env: serviceContext.env,
            user,
            noteId: params.note_id,
            prompt: body.prompt,
            projectId: query.project_id,
          }),
      })
      .collectionAction("transcribe", {
        auth: true,
        summary: "Draft note content from media",
        description:
          "Transcribes an audio or video URL and produces the selected outputs as note content.",
        middleware: access,
        querySchema: projectScopeQuerySchema,
        bodySchema: generateNotesFromMediaSchema,
        responses: {
          200: { description: "Generated content", schema: generateNotesFromMediaResponseSchema },
        },
        handler: async ({ body, serviceContext, user }) => ({
          content: (
            await generateDocumentFromMedia({
              context: serviceContext,
              user,
              url: body.url,
              outputs: body.outputs,
              documentType: body.noteType,
              extraPrompt: body.extraPrompt,
              timestamps: body.timestamps,
            })
          ).content,
        }),
      });
  });
}
