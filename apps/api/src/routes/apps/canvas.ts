import { addRoute } from "~/lib/http/routeBuilder";
import { Hono } from "hono";
import z from "zod/v4";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
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

const canvasGenerationParamsSchema = z.object({
	id: z.string().min(1),
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
	modelOptions: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

addRoute(app, "get", "/models", {
	tags: ["apps"],
	description: "List models available for Canvas image or video generation",
	querySchema: listCanvasModelsQuerySchema,
	responses: {
		200: { description: "List of Canvas-compatible models", schema: z.any() },
	},
	handler: async ({ query, serviceContext, user }) => {
		const mode: CanvasMode = query.mode;
		const models = await listCanvasModels({
			env: serviceContext.env,
			mode,
			userId: user?.id,
		});

		return { models };
	},
});

addRoute(app, "post", "/generate", {
	tags: ["apps"],
	description: "Queue multi-model image/video generations using a standard Canvas payload",
	auth: true,
	bodySchema: generateCanvasSchema,
	responses: {
		200: { description: "Generation queue results", schema: z.any() },
	},
	handler: async ({ body, serviceContext, user }) => {
		try {
			const generations = await generateCanvasBatch({
				context: serviceContext,
				params: body,
				user,
			});

			return { generations };
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}

			routeLogger.error("Error generating canvas outputs:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to generate canvas outputs");
		}
	},
});

addRoute(app, "get", "/generations", {
	tags: ["apps"],
	description: "List a user's Canvas generations with provider-agnostic status and outputs",
	auth: true,
	querySchema: listCanvasGenerationsQuerySchema,
	responses: {
		200: { description: "List of Canvas generations", schema: z.any() },
	},
	handler: async ({ query, serviceContext, user }) => {
		try {
			const generations = await listCanvasGenerations({
				context: serviceContext,
				userId: user.id,
				mode: query.mode,
			});

			return { generations };
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}

			routeLogger.error("Error listing Canvas generations:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to list Canvas generations");
		}
	},
});

addRoute(app, "get", "/generations/:id", {
	tags: ["apps"],
	description: "Get a specific Canvas generation",
	auth: true,
	paramSchema: canvasGenerationParamsSchema,
	responses: {
		200: { description: "Canvas generation details", schema: z.any() },
	},
	handler: async ({ params, serviceContext, user }) => {
		try {
			const generation = await getCanvasGenerationDetails({
				context: serviceContext,
				userId: user.id,
				generationId: params.id,
			});

			return { generation };
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}

			routeLogger.error("Error fetching Canvas generation:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to fetch Canvas generation");
		}
	},
});

export default app;
