import { addRoute } from "~/lib/http/routeBuilder";
import { Hono } from "hono";

import z from "zod/v4";
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
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateNotesFromMedia } from "~/services/apps/notes/generate-from-media";
import {
	projectScopeQuerySchema,
	requireProjectCapabilityAccess,
} from "~/services/workspaces/access";

const app = new Hono();
const routeLogger = createRouteLogger("apps/notes");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing apps route: ${c.req.path}`);
	return next();
});

const noteParamsSchema = z.object({
	id: z.string().min(1),
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
	auth: true,
	querySchema: projectScopeQuerySchema,
	middleware: [requirePlan("pro")],
	handler: async ({ query, serviceContext, user }) => {
		try {
			if (query.projectId) {
				await requireProjectCapabilityAccess(
					serviceContext,
					query.projectId,
					"app",
					"featured-note-taker",
				);
			}

			const notes = await listNotes({
				context: serviceContext,
				userId: user.id,
				projectId: query.projectId,
			});

			return { notes };
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
});

addRoute(app, "get", "/:id", {
	tags: ["apps"],
	description: "Get note details",
	paramSchema: noteParamsSchema,
	responses: {
		200: { description: "Note details", schema: noteDetailResponseSchema },
		404: { description: "Note not found", schema: errorResponseSchema },
	},
	auth: true,
	querySchema: projectScopeQuerySchema,
	middleware: [requirePlan("pro")],
	handler: async ({ params, query, serviceContext, user }) => {
		try {
			if (query.projectId) {
				await requireProjectCapabilityAccess(
					serviceContext,
					query.projectId,
					"app",
					"featured-note-taker",
				);
			}

			const note = await getNote({
				context: serviceContext,
				userId: user.id,
				noteId: params.id,
				projectId: query.projectId,
			});

			return { note };
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
	auth: true,
	querySchema: projectScopeQuerySchema,
	middleware: [requirePlan("pro")],
	handler: async ({ body, query, serviceContext, user }) => {
		try {
			if (query.projectId) {
				await requireProjectCapabilityAccess(
					serviceContext,
					query.projectId,
					"app",
					"featured-note-taker",
				);
			}

			const note = await createNote({
				context: serviceContext,
				env: serviceContext.env,
				user,
				data: body,
				projectId: query.projectId,
			});

			return { note };
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}
			routeLogger.error("Error creating note:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to create note", ErrorType.UNKNOWN_ERROR);
		}
	},
});

addRoute(app, "put", "/:id", {
	tags: ["apps"],
	description: "Update an existing note",
	bodySchema: noteUpdateSchema,
	paramSchema: noteParamsSchema,
	responses: {
		200: { description: "Updated note", schema: noteDetailResponseSchema },
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
		404: { description: "Note not found", schema: errorResponseSchema },
	},
	auth: true,
	querySchema: projectScopeQuerySchema,
	middleware: [requirePlan("pro")],
	handler: async ({ body, params, query, serviceContext, user }) => {
		try {
			if (query.projectId) {
				await requireProjectCapabilityAccess(
					serviceContext,
					query.projectId,
					"app",
					"featured-note-taker",
				);
			}

			const note = await updateNote({
				context: serviceContext,
				env: serviceContext.env,
				user,
				noteId: params.id,
				data: body,
				projectId: query.projectId,
			});

			return { note };
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}
			routeLogger.error("Error updating note:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to update note", ErrorType.UNKNOWN_ERROR);
		}
	},
});

addRoute(app, "delete", "/:id", {
	tags: ["apps"],
	description: "Delete a note",
	paramSchema: noteParamsSchema,
	responses: {
		200: { description: "Note deleted", schema: successResponseSchema },
		404: { description: "Note not found", schema: errorResponseSchema },
	},
	auth: true,
	querySchema: projectScopeQuerySchema,
	middleware: [requirePlan("pro")],
	handler: async ({ params, query, serviceContext, user }) => {
		try {
			if (query.projectId) {
				await requireProjectCapabilityAccess(
					serviceContext,
					query.projectId,
					"app",
					"featured-note-taker",
				);
			}

			await deleteNote({
				context: serviceContext,
				env: serviceContext.env,
				user,
				noteId: params.id,
				projectId: query.projectId,
			});

			return { status: "success", message: "Note deleted" };
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}
			routeLogger.error("Error deleting note:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to delete note", ErrorType.UNKNOWN_ERROR);
		}
	},
});

addRoute(app, "post", "/:id/format", {
	tags: ["apps"],
	description: "Format an existing note via AI",
	bodySchema: noteFormatSchema,
	paramSchema: noteParamsSchema,
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
	auth: true,
	querySchema: projectScopeQuerySchema,
	middleware: [requirePlan("pro")],
	handler: async ({ body, params, query, serviceContext, user }) => {
		try {
			if (query.projectId) {
				await requireProjectCapabilityAccess(
					serviceContext,
					query.projectId,
					"app",
					"featured-note-taker",
				);
			}

			const result = await formatNote({
				context: serviceContext,
				env: serviceContext.env,
				user,
				noteId: params.id,
				prompt: body.prompt,
				projectId: query.projectId,
			});

			return result;
		} catch (error) {
			if (error instanceof AssistantError) throw error;
			routeLogger.error("Error formatting note:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to format note", ErrorType.UNKNOWN_ERROR);
		}
	},
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
	auth: true,
	querySchema: projectScopeQuerySchema,
	middleware: [requirePlan("pro")],
	handler: async ({ body, query, serviceContext, user }) => {
		try {
			if (query.projectId) {
				await requireProjectCapabilityAccess(
					serviceContext,
					query.projectId,
					"app",
					"featured-note-taker",
				);
			}

			const result = await generateNotesFromMedia({
				env: serviceContext.env,
				user,
				url: body.url,
				outputs: body.outputs,
				noteType: body.noteType,
				extraPrompt: body.extraPrompt,
				timestamps: body.timestamps,
				useVideoAnalysis: body.useVideoAnalysis,
				enableVideoSearch: body.enableVideoSearch,
			});

			return { content: result.content };
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}
			routeLogger.error("Error generating notes from media:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to generate notes from media", ErrorType.UNKNOWN_ERROR);
		}
	},
});

export default app;
