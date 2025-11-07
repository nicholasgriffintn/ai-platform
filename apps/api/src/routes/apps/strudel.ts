import { type Context, Hono } from "hono";
import { describeRoute, resolver, validator as zValidator } from "hono-openapi";
import type { z } from "zod";
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
import { requirePlan } from "~/middleware/requirePlan";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { generateStrudelCode } from "~/services/apps/strudel/generate";
import { listPatterns } from "~/services/apps/strudel/list";
import { savePattern } from "~/services/apps/strudel/save";
import { getPatternDetails } from "~/services/apps/strudel/get-details";
import { updatePattern } from "~/services/apps/strudel/update";
import { deletePattern } from "~/services/apps/strudel/delete";
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

app.get(
	"/",
	describeRoute({
		tags: ["apps"],
		description: "List user's saved Strudel patterns",
		responses: {
			200: {
				description: "List of user's Strudel patterns",
				content: {
					"application/json": {
						schema: resolver(strudelListPatternsResponseSchema),
					},
				},
			},
			401: {
				description: "Unauthorized",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
	async (c: Context) => {
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
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError(
				"Failed to list Strudel patterns",
				ErrorType.UNKNOWN_ERROR,
			);
		}
	},
);

app.get(
	"/:id",
	describeRoute({
		tags: ["apps"],
		description: "Get Strudel pattern details",
		responses: {
			200: {
				description: "Pattern details",
				content: {
					"application/json": {
						schema: resolver(strudelPatternDetailResponseSchema),
					},
				},
			},
			404: {
				description: "Pattern not found",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
	async (c: Context) => {
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
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError(
				"Failed to fetch Strudel pattern",
				ErrorType.UNKNOWN_ERROR,
			);
		}
	},
);

app.post(
	"/generate",
	describeRoute({
		tags: ["apps"],
		description: "Generate Strudel code from natural language prompt using AI",
		responses: {
			200: {
				description: "Generated Strudel code",
				content: {
					"application/json": {
						schema: resolver(strudelGenerateResponseSchema),
					},
				},
			},
		},
	}),
	zValidator("json", strudelGenerateSchema),
	async (c: Context) => {
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
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError(
				"Failed to generate Strudel code",
				ErrorType.UNKNOWN_ERROR,
			);
		}
	},
);

app.post(
	"/",
	describeRoute({
		tags: ["apps"],
		description: "Save a new Strudel pattern",
		responses: {
			200: {
				description: "Pattern saved successfully",
				content: {
					"application/json": {
						schema: resolver(strudelPatternDetailResponseSchema),
					},
				},
			},
		},
	}),
	zValidator("json", strudelSavePatternSchema),
	async (c: Context) => {
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
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError(
				"Failed to save Strudel pattern",
				ErrorType.UNKNOWN_ERROR,
			);
		}
	},
);

app.put(
	"/:id",
	describeRoute({
		tags: ["apps"],
		description: "Update an existing Strudel pattern",
		responses: {
			200: {
				description: "Pattern updated successfully",
				content: {
					"application/json": {
						schema: resolver(strudelPatternDetailResponseSchema),
					},
				},
			},
		},
	}),
	zValidator("json", strudelUpdatePatternSchema),
	async (c: Context) => {
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
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError(
				"Failed to update Strudel pattern",
				ErrorType.UNKNOWN_ERROR,
			);
		}
	},
);

app.delete(
	"/:id",
	describeRoute({
		tags: ["apps"],
		description: "Delete a Strudel pattern",
		responses: {
			200: {
				description: "Pattern deleted successfully",
				content: {
					"application/json": {
						schema: resolver(successResponseSchema),
					},
				},
			},
		},
	}),
	async (c: Context) => {
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
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError(
				"Failed to delete Strudel pattern",
				ErrorType.UNKNOWN_ERROR,
			);
		}
	},
);

export default app;
