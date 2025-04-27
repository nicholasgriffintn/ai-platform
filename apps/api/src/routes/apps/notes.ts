import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import {
  createNote,
  deleteNote,
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
  noteUpdateSchema,
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
        content: {
          "application/json": { schema: resolver(listNotesResponseSchema) },
        },
      },
    },
  }),
  async (c: Context) => {
    const user = c.get("user") as IUser;
    try {
      const notes = await listNotes({ env: c.env as IEnv, userId: user.id });
      return c.json({ notes });
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }
      routeLogger.error("Error listing notes:", error);
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
        content: {
          "application/json": { schema: resolver(noteDetailResponseSchema) },
        },
      },
      404: {
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
    },
  }),
  async (c: Context) => {
    const id = c.req.param("id");
    const user = c.get("user") as IUser;
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
      routeLogger.error("Error fetching note:", error);
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
      content: { "application/json": { schema: resolver(noteCreateSchema) } },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: resolver(noteDetailResponseSchema) },
        },
      },
      400: {
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
    },
  }),
  zValidator("json", noteCreateSchema),
  async (c: Context) => {
    const user = c.get("user") as IUser;
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
      routeLogger.error("Error creating note:", error);
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
      content: { "application/json": { schema: resolver(noteUpdateSchema) } },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: resolver(noteDetailResponseSchema) },
        },
      },
      400: {
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
      404: {
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
      routeLogger.error("Error updating note:", error);
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
        content: {
          "application/json": { schema: resolver(successResponseSchema) },
        },
      },
      404: {
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
    },
  }),
  async (c: Context) => {
    const id = c.req.param("id");
    const user = c.get("user") as IUser;
    try {
      await deleteNote({ env: c.env as IEnv, userId: user.id, noteId: id });
      return c.json({ success: true, message: "Note deleted" });
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }
      routeLogger.error("Error deleting note:", error);
      throw new AssistantError(
        "Failed to delete note",
        ErrorType.UNKNOWN_ERROR,
      );
    }
  },
);

export default app;
