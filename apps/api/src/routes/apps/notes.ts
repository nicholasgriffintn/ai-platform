import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import {
  createNote,
  deleteNote,
  formatNote,
  getNote,
  listNotes,
  updateNote,
} from "~/services/apps/notes";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import {
  listNotesResponseSchema,
  noteCreateSchema,
  noteDetailResponseSchema,
  noteFormatResponseSchema,
  noteFormatSchema,
  noteUpdateSchema,
  noteGenerateFromTranscriptSchema,
  noteGenerateFromTranscriptResponseSchema,
} from "../schemas/apps";
import { errorResponseSchema, successResponseSchema } from "../schemas/shared";

const app = new Hono();
const routeLogger = createRouteLogger("APPS_NOTES");

app.use("/*", (c, next) => {
  routeLogger.info(`Processing apps route: ${c.req.path}`);
  return next();
});

app.get(
  "/",
  describeRoute({
    tags: ["apps", "notes"],
    description: "List user's notes",
    responses: {
      200: {
        description: "List of user's notes",
        content: {
          "application/json": { schema: resolver(listNotesResponseSchema) },
        },
      },
    },
  }),
  async (c: Context) => {
    const user = c.get("user") as IUser;

    if (!user?.id) {
      return c.json(
        {
          response: {
            status: "error",
            message: "User not authenticated",
          },
        },
        401,
      );
    }

    if (user.plan_id !== "pro") {
      return c.json(
        {
          response: {
            status: "error",
            message: "User is not on pro plan",
          },
        },
        401,
      );
    }

    try {
      const notes = await listNotes({ env: c.env as IEnv, userId: user.id });
      return c.json({ notes });
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }
      routeLogger.error("Error listing notes:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
      throw new AssistantError("Failed to list notes", ErrorType.UNKNOWN_ERROR);
    }
  },
);

app.get(
  "/:id",
  describeRoute({
    tags: ["apps", "notes"],
    description: "Get note details",
    responses: {
      200: {
        description: "Note details",
        content: {
          "application/json": { schema: resolver(noteDetailResponseSchema) },
        },
      },
      404: {
        description: "Note not found",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
    },
  }),
  async (c: Context) => {
    const id = c.req.param("id");
    const user = c.get("user") as IUser;

    if (!user?.id) {
      return c.json(
        {
          response: {
            status: "error",
            message: "User not authenticated",
          },
        },
        401,
      );
    }

    if (user.plan_id !== "pro") {
      return c.json(
        {
          response: {
            status: "error",
            message: "User is not on pro plan",
          },
        },
        401,
      );
    }

    try {
      const note = await getNote({
        env: c.env as IEnv,
        userId: user.id,
        noteId: id,
      });
      return c.json({ note });
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }
      routeLogger.error("Error fetching note:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
      throw new AssistantError("Failed to fetch note", ErrorType.UNKNOWN_ERROR);
    }
  },
);

app.post(
  "/",
  describeRoute({
    tags: ["apps", "notes"],
    description: "Create a new note",
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              content: { type: "string" },
            },
            required: ["title", "content"],
          },
        },
      },
    },
    responses: {
      200: {
        description: "Newly created note",
        content: {
          "application/json": { schema: resolver(noteDetailResponseSchema) },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
    },
  }),
  zValidator("json", noteCreateSchema),
  async (c: Context) => {
    const user = c.get("user") as IUser;

    if (!user?.id) {
      return c.json(
        {
          response: {
            status: "error",
            message: "User not authenticated",
          },
        },
        401,
      );
    }

    if (user.plan_id !== "pro") {
      return c.json(
        {
          response: {
            status: "error",
            message: "User is not on pro plan",
          },
        },
        401,
      );
    }

    const body = c.req.valid("json" as never) as {
      title: string;
      content: string;
    };
    try {
      const note = await createNote({ env: c.env as IEnv, user, data: body });
      return c.json({ note });
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }
      routeLogger.error("Error creating note:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
      throw new AssistantError(
        "Failed to create note",
        ErrorType.UNKNOWN_ERROR,
      );
    }
  },
);

app.put(
  "/:id",
  describeRoute({
    tags: ["apps", "notes"],
    description: "Update an existing note",
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "string" } },
    ],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              content: { type: "string" },
            },
            required: ["title", "content"],
          },
        },
      },
    },
    responses: {
      200: {
        description: "Updated note",
        content: {
          "application/json": { schema: resolver(noteDetailResponseSchema) },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
      404: {
        description: "Note not found",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
    },
  }),
  zValidator("json", noteUpdateSchema),
  async (c: Context) => {
    const id = c.req.param("id");
    const body = c.req.valid("json" as never) as {
      title: string;
      content: string;
    };
    const user = c.get("user") as IUser;

    if (!user?.id) {
      return c.json(
        {
          response: {
            status: "error",
            message: "User not authenticated",
          },
        },
        401,
      );
    }

    if (user.plan_id !== "pro") {
      return c.json(
        {
          response: {
            status: "error",
            message: "User is not on pro plan",
          },
        },
        401,
      );
    }

    try {
      const note = await updateNote({
        env: c.env as IEnv,
        userId: user.id,
        noteId: id,
        data: body,
      });
      return c.json({ note });
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }
      routeLogger.error("Error updating note:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
      throw new AssistantError(
        "Failed to update note",
        ErrorType.UNKNOWN_ERROR,
      );
    }
  },
);

app.delete(
  "/:id",
  describeRoute({
    tags: ["apps", "notes"],
    description: "Delete a note",
    responses: {
      200: {
        description: "Note deleted",
        content: {
          "application/json": { schema: resolver(successResponseSchema) },
        },
      },
      404: {
        description: "Note not found",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
    },
  }),
  async (c: Context) => {
    const id = c.req.param("id");
    const user = c.get("user") as IUser;

    if (!user?.id) {
      return c.json(
        {
          response: {
            status: "error",
            message: "User not authenticated",
          },
        },
        401,
      );
    }

    if (user.plan_id !== "pro") {
      return c.json(
        {
          response: {
            status: "error",
            message: "User is not on pro plan",
          },
        },
        401,
      );
    }

    try {
      await deleteNote({ env: c.env as IEnv, userId: user.id, noteId: id });
      return c.json({ success: true, message: "Note deleted" });
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }
      routeLogger.error("Error deleting note:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
      throw new AssistantError(
        "Failed to delete note",
        ErrorType.UNKNOWN_ERROR,
      );
    }
  },
);

app.post(
  "/:id/format",
  describeRoute({
    tags: ["apps", "notes"],
    description: "Format an existing note via AI",
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "string" } },
    ],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              prompt: { type: "string" },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: "Formatted note content",
        content: {
          "application/json": { schema: resolver(noteFormatResponseSchema) },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
      404: {
        description: "Note not found",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
    },
  }),
  zValidator("json", noteFormatSchema),
  async (c: Context) => {
    const id = c.req.param("id");
    const { prompt } = c.req.valid("json" as never) as { prompt?: string };
    const user = c.get("user") as IUser;

    if (!user?.id) {
      return c.json(
        {
          response: {
            status: "error",
            message: "User not authenticated",
          },
        },
        401,
      );
    }

    if (user.plan_id !== "pro") {
      return c.json(
        {
          response: {
            status: "error",
            message: "User is not on pro plan",
          },
        },
        401,
      );
    }

    try {
      const result = await formatNote({
        env: c.env as IEnv,
        user,
        noteId: id,
        prompt,
      });
      return c.json(result);
    } catch (error) {
      if (error instanceof AssistantError) throw error;
      routeLogger.error("Error formatting note:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
      throw new AssistantError(
        "Failed to format note",
        ErrorType.UNKNOWN_ERROR,
      );
    }
  },
);

app.post(
  "/:id/generate-from-transcript",
  describeRoute({
    tags: ["apps", "notes"],
    description: "Generate note content from an uploaded audio transcript",
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "string" } },
    ],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              transcript: { type: "string" },
              category: { type: "string", enum: ["tutorial_only", "class_lecture"] },
              prompt: { type: "string" },
            },
            required: ["transcript"],
          },
        },
      },
    },
    responses: {
      200: {
        description: "Generated note content",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: { content: { type: "string" } },
              required: ["content"],
            },
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: { "application/json": { schema: resolver(errorResponseSchema) } },
      },
    },
  }),
  zValidator("json", noteGenerateFromTranscriptSchema),
  async (c: Context) => {
    const id = c.req.param("id");
    const user = c.get("user") as IUser;
    const body = c.req.valid("json" as never) as {
      transcript: string;
      category?: "tutorial_only" | "class_lecture";
      prompt?: string;
    };

    if (!user?.id) {
      return c.json(
        { response: { status: "error", message: "User not authenticated" } },
        401,
      );
    }

    if (user.plan_id !== "pro") {
      return c.json(
        { response: { status: "error", message: "User is not on pro plan" } },
        401,
      );
    }

    try {
      // Validate the user has access to the note id (throws if not)
      await getNote({ env: c.env as IEnv, userId: user.id, noteId: id });

      const { generateNotesFromTranscript } = await import(
        "~/services/apps/notes"
      );

      const result = await generateNotesFromTranscript({
        env: c.env as IEnv,
        user,
        transcript: body.transcript,
        category: body.category,
        prompt: body.prompt,
      });
      return c.json(result);
    } catch (error) {
      if (error instanceof AssistantError) throw error;
      routeLogger.error("Error generating notes from transcript:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
      throw new AssistantError(
        "Failed to generate notes from transcript",
        ErrorType.UNKNOWN_ERROR,
      );
    }
  },
);

export default app;
