import { addRoute } from "~/lib/http/routeBuilder";
import { Hono } from "hono";
import { z } from "zod/v4";
import {
	drawingSchema,
	guessDrawingSchema,
	apiResponseSchema,
	errorResponseSchema,
} from "@assistant/schemas";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { requirePlan } from "~/middleware/requirePlan";
import { generateImageFromDrawing } from "~/services/apps/drawing/create";
import { getDrawingDetails } from "~/services/apps/drawing/get-details";
import { guessDrawingFromImage } from "~/services/apps/drawing/guess";
import { listDrawings } from "~/services/apps/drawing/list";
import { AssistantError, ErrorType } from "~/utils/errors";

const app = new Hono();

const routeLogger = createRouteLogger("apps/drawing");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing apps route: ${c.req.path}`);
	return next();
});

const drawingParamsSchema = z.object({
	id: z.string().min(1),
});

addRoute(app, "get", "/", {
	tags: ["apps"],
	description: "List user's drawings",
	responses: {
		200: { description: "List of user's drawings", schema: apiResponseSchema },
		401: { description: "Unauthorized", schema: errorResponseSchema },
	},
	auth: true,
	middleware: [requirePlan("pro")],
	handler: async ({ serviceContext, user }) => {
		try {
			const drawings = await listDrawings({
				context: serviceContext,
				userId: user.id,
			});

			return { drawings };
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}
			routeLogger.error("Error listing drawings:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to list drawings", ErrorType.UNKNOWN_ERROR);
		}
	},
});

addRoute(app, "get", "/:id", {
	tags: ["apps"],
	description: "Get drawing details",
	paramSchema: drawingParamsSchema,
	responses: {
		200: { description: "Drawing details", schema: apiResponseSchema },
		404: { description: "Drawing not found", schema: errorResponseSchema },
	},
	auth: true,
	middleware: [requirePlan("pro")],
	handler: async ({ params, serviceContext, user }) => {
		try {
			const drawing = await getDrawingDetails({
				context: serviceContext,
				userId: user.id,
				drawingId: params.id,
			});

			return { drawing };
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}
			routeLogger.error("Error fetching drawing:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to fetch drawing", ErrorType.UNKNOWN_ERROR);
		}
	},
});

addRoute(app, "post", "/", {
	tags: ["apps"],
	description: "Generate an image from a drawing",
	formSchema: drawingSchema,
	responses: {
		200: { description: "Response", schema: apiResponseSchema },
	},
	auth: true,
	middleware: [requirePlan("pro")],
	handler: async ({ raw, serviceContext, user }) => {
		const body = raw.req.valid("form" as never) as {
			drawing: File;
			drawingId?: string;
		};

		try {
			const response = await generateImageFromDrawing({
				context: serviceContext,
				env: serviceContext.env,
				request: body,
				user,
				existingDrawingId: body.drawingId,
			});

			if (response.status === "error") {
				throw new AssistantError(
					"Something went wrong, we are working on it",
					ErrorType.UNKNOWN_ERROR,
				);
			}

			return response;
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}
			routeLogger.error("Error generating image from drawing:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to generate image", ErrorType.UNKNOWN_ERROR);
		}
	},
});

addRoute(app, "post", "/guess", {
	tags: ["apps"],
	description: "Guess a drawing from an image",
	formSchema: guessDrawingSchema,
	responses: {
		200: { description: "Response", schema: apiResponseSchema },
	},
	auth: true,
	middleware: [requirePlan("pro")],
	handler: async ({ raw, serviceContext, user }) => {
		const body = raw.req.valid("form" as never);

		try {
			const response = await guessDrawingFromImage({
				context: serviceContext,
				env: serviceContext.env,
				request: body,
				user,
			});

			if (response.status === "error") {
				throw new AssistantError(
					"Something went wrong, we are working on it",
					ErrorType.UNKNOWN_ERROR,
				);
			}

			return response;
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}
			routeLogger.error("Error guessing drawing from image:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to guess drawing", ErrorType.UNKNOWN_ERROR);
		}
	},
});

export default app;
