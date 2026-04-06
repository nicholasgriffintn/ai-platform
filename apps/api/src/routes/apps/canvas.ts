import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, Hono } from "hono";
import z from "zod/v4";

import { getServiceContext } from "~/lib/context/serviceContext";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import type { IUser } from "~/types";
import { AssistantError } from "~/utils/errors";
import { generateCanvasBatch } from "~/services/apps/canvas/generate";
import { listCanvasModels } from "~/services/apps/canvas/list-models";
import type { CanvasMode } from "~/services/apps/canvas/types";
import { listCanvasGenerations } from "~/services/apps/canvas/list-generations";
import { getCanvasGenerationDetails } from "~/services/apps/canvas/get-generation";

const app = new Hono();

const routeLogger = createRouteLogger("apps/canvas");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing canvas route: ${c.req.path}`);
	return next();
});

const listCanvasModelsQuerySchema = z.object({
	mode: z.enum(["image", "video"]).default("image"),
});

const listCanvasGenerationsQuerySchema = z.object({
	mode: z.enum(["image", "video"]).optional(),
});

const generateCanvasSchema = z.object({
	mode: z.enum(["image", "video"]),
	prompt: z.string().min(1),
	modelIds: z.array(z.string().min(1)).min(1).max(12),
	referenceImages: z.array(z.string()).max(8).optional(),
	negativePrompt: z.string().optional(),
	aspectRatio: z.string().optional(),
	resolution: z.string().optional(),
	width: z.number().int().positive().optional(),
	height: z.number().int().positive().optional(),
	durationSeconds: z.number().int().positive().max(20).optional(),
	generateAudio: z.boolean().optional(),
});

addRoute(app, "get", "/models", {
	tags: ["apps"],
	description: "List models available for Canvas image or video generation",
	querySchema: listCanvasModelsQuerySchema,
	responses: {
		200: { description: "List of Canvas-compatible models", schema: z.any() },
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const query = context.req.valid("query" as never) as z.infer<
				typeof listCanvasModelsQuerySchema
			>;
			const mode: CanvasMode = query.mode;
			const user = context.get("user") as IUser | undefined;

			const models = await listCanvasModels({
				env: context.env,
				mode,
				userId: user?.id,
			});

			return ResponseFactory.success(context, { models });
		})(raw),
});

addRoute(app, "post", "/generate", {
	tags: ["apps"],
	description:
		"Queue multi-model image/video generations using a standard Canvas payload",
	bodySchema: generateCanvasSchema,
	responses: {
		200: { description: "Generation queue results", schema: z.any() },
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const user = context.get("user") as IUser;
			const body = context.req.valid("json" as never) as z.infer<
				typeof generateCanvasSchema
			>;

			if (!user?.id) {
				return ResponseFactory.error(context, "User not authenticated", 401);
			}

			try {
				const serviceContext = getServiceContext(context);
				const generations = await generateCanvasBatch({
					context: serviceContext,
					params: body,
					user,
				});

				return ResponseFactory.success(context, { generations });
			} catch (error) {
				if (error instanceof AssistantError) {
					throw error;
				}

				routeLogger.error("Error generating canvas outputs:", {
					error_message:
						error instanceof Error ? error.message : "Unknown error",
				});
				throw new AssistantError("Failed to generate canvas outputs");
			}
		})(raw),
});

addRoute(app, "get", "/generations", {
	tags: ["apps"],
	description:
		"List a user's Canvas generations with provider-agnostic status and outputs",
	querySchema: listCanvasGenerationsQuerySchema,
	responses: {
		200: { description: "List of Canvas generations", schema: z.any() },
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const user = context.get("user") as IUser;
			const query = context.req.valid("query" as never) as z.infer<
				typeof listCanvasGenerationsQuerySchema
			>;

			if (!user?.id) {
				return ResponseFactory.error(context, "User not authenticated", 401);
			}

			try {
				const serviceContext = getServiceContext(context);
				const generations = await listCanvasGenerations({
					context: serviceContext,
					userId: user.id,
					mode: query.mode,
				});

				return ResponseFactory.success(context, { generations });
			} catch (error) {
				if (error instanceof AssistantError) {
					throw error;
				}

				routeLogger.error("Error listing Canvas generations:", {
					error_message:
						error instanceof Error ? error.message : "Unknown error",
				});
				throw new AssistantError("Failed to list Canvas generations");
			}
		})(raw),
});

addRoute(app, "get", "/generations/:id", {
	tags: ["apps"],
	description: "Get a specific Canvas generation",
	responses: {
		200: { description: "Canvas generation details", schema: z.any() },
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const user = context.get("user") as IUser;
			const generationId = context.req.param("id");

			if (!user?.id) {
				return ResponseFactory.error(context, "User not authenticated", 401);
			}

			try {
				const serviceContext = getServiceContext(context);
				const generation = await getCanvasGenerationDetails({
					context: serviceContext,
					userId: user.id,
					generationId,
				});

				return ResponseFactory.success(context, { generation });
			} catch (error) {
				if (error instanceof AssistantError) {
					throw error;
				}

				routeLogger.error("Error fetching Canvas generation:", {
					error_message:
						error instanceof Error ? error.message : "Unknown error",
				});
				throw new AssistantError("Failed to fetch Canvas generation");
			}
		})(raw),
});

export default app;
