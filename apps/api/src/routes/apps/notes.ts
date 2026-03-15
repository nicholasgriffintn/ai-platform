import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, Hono } from "hono";

import type { z } from "zod";
import {
	listNotesResponseSchema,
	noteCreateSchema,
	noteDetailResponseSchema,
	noteFormatResponseSchema,
	noteFormatSchema,
	noteUpdateSchema,
	generateNotesFromMediaSchema,
	generateNotesFromMediaResponseSchema,
	errorResponseSchema,
	successResponseSchema,
} from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { requirePlan } from "~/middleware/requirePlan";
import {
	createNote,
	deleteNote,
	formatNote,
	getNote,
	listNotes,
	updateNote,
} from "~/services/apps/notes/list";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateNotesFromMedia } from "~/services/apps/notes/generate-from-media";

type NoteUpdatePayload = z.infer<typeof noteUpdateSchema>;

const app = new Hono();
const routeLogger = createRouteLogger("apps/notes");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing apps route: ${c.req.path}`);
	return next();
});

addRoute(app, "get", "/", {
	tags: ["apps"],
	description: "List user's notes",
	responses: {
		200: {
			description: "List of user's notes",
			schema: listNotesResponseSchema,
		},
	},
	middleware: [requirePlan("pro")],
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const user = c.get("user") as IUser;

			try {
				const serviceContext = getServiceContext(c);
				const notes = await listNotes({
					context: serviceContext,
					userId: user.id,
				});
				return ResponseFactory.success(c, { notes });
			} catch (error) {
				if (error instanceof AssistantError) {
					throw error;
				}
				routeLogger.error("Error listing notes:", {
					error_message:
						error instanceof Error ? error.message : "Unknown error",
				});
				throw new AssistantError(
					"Failed to list notes",
					ErrorType.UNKNOWN_ERROR,
				);
			}
		})(raw),
});

addRoute(app, "get", "/:id", {
	tags: ["apps"],
	description: "Get note details",
	responses: {
		200: { description: "Note details", schema: noteDetailResponseSchema },
		404: { description: "Note not found", schema: errorResponseSchema },
	},
	middleware: [requirePlan("pro")],
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const id = c.req.param("id");
			const user = c.get("user") as IUser;

			try {
				const serviceContext = getServiceContext(c);
				const note = await getNote({
					context: serviceContext,
					userId: user.id,
					noteId: id,
				});
				return ResponseFactory.success(c, { note });
			} catch (error) {
				if (error instanceof AssistantError) {
					throw error;
				}
				routeLogger.error("Error fetching note:", {
					error_message:
						error instanceof Error ? error.message : "Unknown error",
				});
				throw new AssistantError(
					"Failed to fetch note",
					ErrorType.UNKNOWN_ERROR,
				);
			}
		})(raw),
});

addRoute(app, "post", "/", {
	tags: ["apps"],
	description: "Create a new note",
	bodySchema: noteCreateSchema,
	responses: {
		200: {
			description: "Newly created note",
			schema: noteDetailResponseSchema,
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
	},
	middleware: [requirePlan("pro")],
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const user = c.get("user") as IUser;
			const body = c.req.valid("json" as never) as {
				title: string;
				content: string;
			};

			try {
				const serviceContext = getServiceContext(c);
				const note = await createNote({
					context: serviceContext,
					env: c.env as IEnv,
					user,
					data: body,
				});
				return ResponseFactory.success(c, { note });
			} catch (error) {
				if (error instanceof AssistantError) {
					throw error;
				}
				routeLogger.error("Error creating note:", {
					error_message:
						error instanceof Error ? error.message : "Unknown error",
				});
				throw new AssistantError(
					"Failed to create note",
					ErrorType.UNKNOWN_ERROR,
				);
			}
		})(raw),
});

addRoute(app, "put", "/:id", {
	tags: ["apps"],
	description: "Update an existing note",
	bodySchema: noteUpdateSchema,
	responses: {
		200: { description: "Updated note", schema: noteDetailResponseSchema },
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
		404: { description: "Note not found", schema: errorResponseSchema },
	},
	middleware: [requirePlan("pro")],
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const id = c.req.param("id");
			const body = c.req.valid("json" as never) as NoteUpdatePayload;
			const user = c.get("user") as IUser;

			try {
				const serviceContext = getServiceContext(c);
				const note = await updateNote({
					context: serviceContext,
					env: c.env as IEnv,
					user,
					noteId: id,
					data: body,
				});
				return ResponseFactory.success(c, { note });
			} catch (error) {
				if (error instanceof AssistantError) {
					throw error;
				}
				routeLogger.error("Error updating note:", {
					error_message:
						error instanceof Error ? error.message : "Unknown error",
				});
				throw new AssistantError(
					"Failed to update note",
					ErrorType.UNKNOWN_ERROR,
				);
			}
		})(raw),
});

addRoute(app, "delete", "/:id", {
	tags: ["apps"],
	description: "Delete a note",
	responses: {
		200: { description: "Note deleted", schema: successResponseSchema },
		404: { description: "Note not found", schema: errorResponseSchema },
	},
	middleware: [requirePlan("pro")],
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const id = c.req.param("id");
			const user = c.get("user") as IUser;

			try {
				const serviceContext = getServiceContext(c);
				await deleteNote({
					context: serviceContext,
					env: c.env as IEnv,
					user,
					noteId: id,
				});
				return ResponseFactory.message(c, "Note deleted");
			} catch (error) {
				if (error instanceof AssistantError) {
					throw error;
				}
				routeLogger.error("Error deleting note:", {
					error_message:
						error instanceof Error ? error.message : "Unknown error",
				});
				throw new AssistantError(
					"Failed to delete note",
					ErrorType.UNKNOWN_ERROR,
				);
			}
		})(raw),
});

addRoute(app, "post", "/:id/format", {
	tags: ["apps"],
	description: "Format an existing note via AI",
	bodySchema: noteFormatSchema,
	responses: {
		200: {
			description: "Formatted note content",
			schema: noteFormatResponseSchema,
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
		404: { description: "Note not found", schema: errorResponseSchema },
	},
	middleware: [requirePlan("pro")],
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const id = c.req.param("id");
			const { prompt } = c.req.valid("json" as never) as { prompt?: string };
			const user = c.get("user") as IUser;

			try {
				const serviceContext = getServiceContext(c);
				const result = await formatNote({
					context: serviceContext,
					env: c.env as IEnv,
					user,
					noteId: id,
					prompt,
				});
				return c.json(result);
			} catch (error) {
				if (error instanceof AssistantError) throw error;
				routeLogger.error("Error formatting note:", {
					error_message:
						error instanceof Error ? error.message : "Unknown error",
				});
				throw new AssistantError(
					"Failed to format note",
					ErrorType.UNKNOWN_ERROR,
				);
			}
		})(raw),
});

addRoute(app, "post", "/generate-from-media", {
	tags: ["apps"],
	description:
		"Generate note content by transcribing an audio/video URL and producing selected outputs.",
	bodySchema: generateNotesFromMediaSchema,
	responses: {
		200: {
			description: "Generated notes content",
			schema: generateNotesFromMediaResponseSchema,
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
	},
	middleware: [requirePlan("pro")],
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const body = c.req.valid("json" as never) as z.infer<
				typeof generateNotesFromMediaSchema
			>;
			const user = c.get("user") as IUser;

			try {
				const result = await generateNotesFromMedia({
					env: c.env as IEnv,
					user,
					url: body.url,
					outputs: body.outputs,
					noteType: body.noteType,
					extraPrompt: body.extraPrompt,
					timestamps: body.timestamps,
					useVideoAnalysis: body.useVideoAnalysis,
					enableVideoSearch: body.enableVideoSearch,
				});
				return ResponseFactory.success(c, { content: result.content });
			} catch (error) {
				if (error instanceof AssistantError) {
					throw error;
				}
				routeLogger.error("Error generating notes from media:", {
					error_message:
						error instanceof Error ? error.message : "Unknown error",
				});
				throw new AssistantError(
					"Failed to generate notes from media",
					ErrorType.UNKNOWN_ERROR,
				);
			}
		})(raw),
});

export default app;
