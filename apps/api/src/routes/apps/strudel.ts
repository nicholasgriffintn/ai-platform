import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, Hono } from "hono";

import { z } from "zod";
import {
	strudelGenerateSchema,
	strudelSavePatternSchema,
	strudelUpdatePatternSchema,
	strudelGenerateResponseSchema,
	strudelListPatternsResponseSchema,
	strudelPatternDetailResponseSchema,
	errorResponseSchema,
	successResponseSchema,
} from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { generateStrudelCode } from "~/services/apps/strudel/generate";
import { listPatterns } from "~/services/apps/strudel/list";
import { savePattern } from "~/services/apps/strudel/save";
import { getPatternDetails } from "~/services/apps/strudel/get-details";
import { updatePattern } from "~/services/apps/strudel/update";
import { deletePattern } from "~/services/apps/strudel/delete";
import { submitStrudelFeedback } from "~/services/apps/strudel/feedback";
import type { IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

type StrudelGenerateBody = z.infer<typeof strudelGenerateSchema>;
type StrudelSaveBody = z.infer<typeof strudelSavePatternSchema>;
type StrudelUpdateBody = z.infer<typeof strudelUpdatePatternSchema>;

const app = new Hono();

const routeLogger = createRouteLogger("apps/strudel");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing strudel route: ${c.req.path}`);
	return next();
});

addRoute(app, "get", "/", {
	tags: ["apps"],
	description: "List user's saved Strudel patterns",
	responses: {
		200: {
			description: "List of user's Strudel patterns",
			schema: strudelListPatternsResponseSchema,
		},
		401: { description: "Unauthorized", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const user = c.get("user") as IUser;

			try {
				const serviceContext = getServiceContext(c);
				const patterns = await listPatterns({
					context: serviceContext,
					userId: user.id,
				});

				return ResponseFactory.success(c, { patterns });
			} catch (error) {
				if (error instanceof AssistantError) {
					throw error;
				}
				routeLogger.error("Error listing Strudel patterns:", {
					error_message:
						error instanceof Error ? error.message : "Unknown error",
				});
				throw new AssistantError(
					"Failed to list Strudel patterns",
					ErrorType.UNKNOWN_ERROR,
				);
			}
		})(raw),
});

addRoute(app, "get", "/:id", {
	tags: ["apps"],
	description: "Get Strudel pattern details",
	responses: {
		200: {
			description: "Pattern details",
			schema: strudelPatternDetailResponseSchema,
		},
		404: { description: "Pattern not found", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const id = c.req.param("id");
			const user = c.get("user") as IUser;

			try {
				const serviceContext = getServiceContext(c);
				const pattern = await getPatternDetails({
					context: serviceContext,
					userId: user.id,
					patternId: id,
				});

				return ResponseFactory.success(c, { pattern });
			} catch (error) {
				if (error instanceof AssistantError) {
					throw error;
				}
				routeLogger.error("Error fetching Strudel pattern:", {
					error_message:
						error instanceof Error ? error.message : "Unknown error",
				});
				throw new AssistantError(
					"Failed to fetch Strudel pattern",
					ErrorType.UNKNOWN_ERROR,
				);
			}
		})(raw),
});

addRoute(app, "post", "/generate", {
	tags: ["apps"],
	description: "Generate Strudel code from natural language prompt using AI",
	bodySchema: strudelGenerateSchema,
	responses: {
		200: {
			description: "Generated Strudel code",
			schema: strudelGenerateResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const body = c.req.valid("json" as never) as StrudelGenerateBody;
			const user = c.get("user") as IUser;

			try {
				const serviceContext = getServiceContext(c);
				const response = await generateStrudelCode({
					context: serviceContext,
					request: body,
					user,
				});

				return ResponseFactory.success(c, response);
			} catch (error) {
				if (error instanceof AssistantError) {
					throw error;
				}
				routeLogger.error("Error generating Strudel code:", {
					error_message:
						error instanceof Error ? error.message : "Unknown error",
					error_stack: error instanceof Error ? error.stack : undefined,
					error_cause: error instanceof Error ? error.cause : undefined,
				});
				throw new AssistantError(
					`Failed to generate Strudel code: ${error instanceof Error ? error.message : "Unknown error"}`,
					ErrorType.UNKNOWN_ERROR,
					500,
					{
						originalError:
							error instanceof Error ? error.message : String(error),
						stack: error instanceof Error ? error.stack : undefined,
					},
				);
			}
		})(raw),
});

addRoute(app, "post", "/", {
	tags: ["apps"],
	description: "Save a new Strudel pattern",
	bodySchema: strudelSavePatternSchema,
	responses: {
		200: {
			description: "Pattern saved successfully",
			schema: strudelPatternDetailResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const body = c.req.valid("json" as never) as StrudelSaveBody;
			const user = c.get("user") as IUser;

			try {
				const serviceContext = getServiceContext(c);
				const pattern = await savePattern({
					context: serviceContext,
					request: body,
					user,
				});

				return ResponseFactory.success(c, { pattern });
			} catch (error) {
				if (error instanceof AssistantError) {
					throw error;
				}
				routeLogger.error("Error saving Strudel pattern:", {
					error_message:
						error instanceof Error ? error.message : "Unknown error",
				});
				throw new AssistantError(
					"Failed to save Strudel pattern",
					ErrorType.UNKNOWN_ERROR,
				);
			}
		})(raw),
});

addRoute(app, "put", "/:id", {
	tags: ["apps"],
	description: "Update an existing Strudel pattern",
	bodySchema: strudelUpdatePatternSchema,
	responses: {
		200: {
			description: "Pattern updated successfully",
			schema: strudelPatternDetailResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const id = c.req.param("id");
			const body = c.req.valid("json" as never) as StrudelUpdateBody;
			const user = c.get("user") as IUser;

			try {
				const serviceContext = getServiceContext(c);
				const pattern = await updatePattern({
					context: serviceContext,
					request: body,
					user,
					patternId: id,
				});

				return ResponseFactory.success(c, { pattern });
			} catch (error) {
				if (error instanceof AssistantError) {
					throw error;
				}
				routeLogger.error("Error updating Strudel pattern:", {
					error_message:
						error instanceof Error ? error.message : "Unknown error",
				});
				throw new AssistantError(
					"Failed to update Strudel pattern",
					ErrorType.UNKNOWN_ERROR,
				);
			}
		})(raw),
});

addRoute(app, "delete", "/:id", {
	tags: ["apps"],
	description: "Delete a Strudel pattern",
	responses: {
		200: {
			description: "Pattern deleted successfully",
			schema: successResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const id = c.req.param("id");
			const user = c.get("user") as IUser;

			try {
				const serviceContext = getServiceContext(c);
				await deletePattern({
					context: serviceContext,
					userId: user.id,
					patternId: id,
				});

				return ResponseFactory.message(c, "Pattern deleted successfully");
			} catch (error) {
				if (error instanceof AssistantError) {
					throw error;
				}
				routeLogger.error("Error deleting Strudel pattern:", {
					error_message:
						error instanceof Error ? error.message : "Unknown error",
				});
				throw new AssistantError(
					"Failed to delete Strudel pattern",
					ErrorType.UNKNOWN_ERROR,
				);
			}
		})(raw),
});

addRoute(app, "post", "/feedback", {
	tags: ["apps"],
	description: "Submit feedback for a Strudel generation",
	bodySchema: z.object({
		generationId: z.string(),
		score: z.number().min(1).max(5).optional(),
		feedback: z.string().optional(),
	}),
	responses: {
		200: {
			description: "Feedback submitted successfully",
			schema: successResponseSchema,
		},
		400: { description: "Bad request", schema: errorResponseSchema },
		404: { description: "Generation not found", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const body = c.req.valid("json" as never) as {
				generationId: string;
				score?: number;
				feedback?: string;
			};

			try {
				const serviceContext = getServiceContext(c);
				const result = await submitStrudelFeedback({
					context: serviceContext,
					generationId: body.generationId,
					score: body.score,
					feedback: body.feedback,
				});

				return ResponseFactory.success(c, result);
			} catch (error) {
				if (error instanceof AssistantError) {
					throw error;
				}
				routeLogger.error("Error submitting Strudel feedback:", {
					error_message:
						error instanceof Error ? error.message : "Unknown error",
				});
				throw new AssistantError(
					"Failed to submit feedback",
					ErrorType.UNKNOWN_ERROR,
				);
			}
		})(raw),
});

export default app;
