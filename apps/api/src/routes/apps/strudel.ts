import { addRoute } from "~/lib/http/routeBuilder";
import { Hono } from "hono";

import { z } from "zod/v4";
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

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { generateStrudelCode } from "~/services/apps/strudel/generate";
import { listPatterns } from "~/services/apps/strudel/list";
import { savePattern } from "~/services/apps/strudel/save";
import { getPatternDetails } from "~/services/apps/strudel/get-details";
import { updatePattern } from "~/services/apps/strudel/update";
import { deletePattern } from "~/services/apps/strudel/delete";
import { submitStrudelFeedback } from "~/services/apps/strudel/feedback";
import { AssistantError, ErrorType } from "~/utils/errors";

const app = new Hono();

const routeLogger = createRouteLogger("apps/strudel");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing strudel route: ${c.req.path}`);
	return next();
});

const patternParamsSchema = z.object({
	id: z.string().min(1),
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
	auth: true,
	handler: async ({ serviceContext, user }) => {
		try {
			const patterns = await listPatterns({
				context: serviceContext,
				userId: user.id,
			});

			return { patterns };
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}
			routeLogger.error("Error listing Strudel patterns:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to list Strudel patterns", ErrorType.UNKNOWN_ERROR);
		}
	},
});

addRoute(app, "get", "/:id", {
	tags: ["apps"],
	description: "Get Strudel pattern details",
	paramSchema: patternParamsSchema,
	responses: {
		200: {
			description: "Pattern details",
			schema: strudelPatternDetailResponseSchema,
		},
		404: { description: "Pattern not found", schema: errorResponseSchema },
	},
	auth: true,
	handler: async ({ params, serviceContext, user }) => {
		try {
			const pattern = await getPatternDetails({
				context: serviceContext,
				userId: user.id,
				patternId: params.id,
			});

			return { pattern };
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}
			routeLogger.error("Error fetching Strudel pattern:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to fetch Strudel pattern", ErrorType.UNKNOWN_ERROR);
		}
	},
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
	auth: true,
	handler: async ({ body, serviceContext, user }) => {
		try {
			const response = await generateStrudelCode({
				context: serviceContext,
				request: body,
				user,
			});

			return response;
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}
			routeLogger.error("Error generating Strudel code:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
				error_stack: error instanceof Error ? error.stack : undefined,
				error_cause: error instanceof Error ? error.cause : undefined,
			});
			throw new AssistantError(
				`Failed to generate Strudel code: ${error instanceof Error ? error.message : "Unknown error"}`,
				ErrorType.UNKNOWN_ERROR,
				500,
				{
					originalError: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
				},
			);
		}
	},
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
	auth: true,
	handler: async ({ body, serviceContext, user }) => {
		try {
			const pattern = await savePattern({
				context: serviceContext,
				request: body,
				user,
			});

			return { pattern };
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}
			routeLogger.error("Error saving Strudel pattern:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to save Strudel pattern", ErrorType.UNKNOWN_ERROR);
		}
	},
});

addRoute(app, "put", "/:id", {
	tags: ["apps"],
	description: "Update an existing Strudel pattern",
	bodySchema: strudelUpdatePatternSchema,
	paramSchema: patternParamsSchema,
	responses: {
		200: {
			description: "Pattern updated successfully",
			schema: strudelPatternDetailResponseSchema,
		},
	},
	auth: true,
	handler: async ({ body, params, serviceContext, user }) => {
		try {
			const pattern = await updatePattern({
				context: serviceContext,
				request: body,
				user,
				patternId: params.id,
			});

			return { pattern };
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}
			routeLogger.error("Error updating Strudel pattern:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to update Strudel pattern", ErrorType.UNKNOWN_ERROR);
		}
	},
});

addRoute(app, "delete", "/:id", {
	tags: ["apps"],
	description: "Delete a Strudel pattern",
	paramSchema: patternParamsSchema,
	responses: {
		200: {
			description: "Pattern deleted successfully",
			schema: successResponseSchema,
		},
	},
	auth: true,
	handler: async ({ params, serviceContext, user }) => {
		try {
			await deletePattern({
				context: serviceContext,
				userId: user.id,
				patternId: params.id,
			});

			return { status: "success", message: "Pattern deleted successfully" };
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}
			routeLogger.error("Error deleting Strudel pattern:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to delete Strudel pattern", ErrorType.UNKNOWN_ERROR);
		}
	},
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
	handler: async ({ body, serviceContext }) => {
		try {
			const result = await submitStrudelFeedback({
				context: serviceContext,
				generationId: body.generationId,
				score: body.score,
				feedback: body.feedback,
			});

			return result;
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}
			routeLogger.error("Error submitting Strudel feedback:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to submit feedback", ErrorType.UNKNOWN_ERROR);
		}
	},
});

export default app;
