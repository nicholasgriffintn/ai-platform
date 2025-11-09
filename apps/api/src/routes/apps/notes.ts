import { type Context, Hono } from "hono";
import { describeRoute, resolver, validator as zValidator } from "hono-openapi";
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

app.get(
	"/",
	describeRoute({
		tags: ["apps"],
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
	requirePlan("pro"),
	async (c: Context) => {
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
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to list notes", ErrorType.UNKNOWN_ERROR);
		}
	},
);

app.get(
	"/:id",
	describeRoute({
		tags: ["apps"],
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
	requirePlan("pro"),
	async (c: Context) => {
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
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to fetch note", ErrorType.UNKNOWN_ERROR);
		}
	},
);

app.post(
	"/",
	describeRoute({
		tags: ["apps"],
		description: "Create a new note",
		requestBody: {
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							title: { type: "string" },
							content: { type: "string" },
							options: { type: "object" },
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
	requirePlan("pro"),
	async (c: Context) => {
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
		tags: ["apps"],
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
	requirePlan("pro"),
	async (c: Context) => {
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
		tags: ["apps"],
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
	requirePlan("pro"),
	async (c: Context) => {
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
		tags: ["apps"],
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
	requirePlan("pro"),
	async (c: Context) => {
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
	"/generate-from-media",
	describeRoute({
		tags: ["apps"],
		description:
			"Generate note content by transcribing an audio/video URL and producing selected outputs.",
		requestBody: {
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							url: { type: "string" },
							outputs: { type: "array", items: { type: "string" } },
							noteType: { type: "string" },
							extraPrompt: { type: "string" },
							timestamps: { type: "boolean" },
						},
					},
				},
			},
		},
		responses: {
			200: {
				description: "Generated notes content",
				content: {
					"application/json": {
						schema: resolver(generateNotesFromMediaResponseSchema),
					},
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
	zValidator("json", generateNotesFromMediaSchema),
	requirePlan("pro"),
	async (c: Context) => {
		const body = c.req.valid("json" as never) as any;
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
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError(
				"Failed to generate notes from media",
				ErrorType.UNKNOWN_ERROR,
			);
		}
	},
);

export default app;
