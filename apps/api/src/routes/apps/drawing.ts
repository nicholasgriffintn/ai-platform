import {
  drawingSchema,
  guessDrawingSchema,
  apiResponseSchema,
  errorResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import { z } from "zod/v4";

import { addRoute } from "~/lib/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { requirePlan } from "~/middleware/requirePlan";
import { generateImageFromDrawing } from "~/services/apps/drawing/create";
import { getDrawingDetails } from "~/services/apps/drawing/get-details";
import { guessDrawingFromImage } from "~/services/apps/drawing/guess";
import { listDrawings } from "~/services/apps/drawing/list";
import {
  projectScopeQuerySchema,
  requireOptionalProjectCapabilityAccess,
} from "~/services/workspaces/access";
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
  querySchema: projectScopeQuerySchema,
  middleware: [requirePlan("pro")],
  handler: async ({ query, serviceContext, user }) => {
    try {
      await requireOptionalProjectCapabilityAccess(
        serviceContext,
        query.projectId,
        "app",
        "featured-image-studio",
      );
      const drawings = await listDrawings({
        context: serviceContext,
        projectId: query.projectId,
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
  querySchema: projectScopeQuerySchema,
  middleware: [requirePlan("pro")],
  handler: async ({ params, query, serviceContext, user }) => {
    try {
      await requireOptionalProjectCapabilityAccess(
        serviceContext,
        query.projectId,
        "app",
        "featured-image-studio",
      );
      const drawing = await getDrawingDetails({
        context: serviceContext,
        projectId: query.projectId,
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
  querySchema: projectScopeQuerySchema,
  middleware: [requirePlan("pro")],
  handler: async ({ raw, query, serviceContext, user }) => {
    const body = drawingSchema.parse(await raw.req.parseBody());

    try {
      await requireOptionalProjectCapabilityAccess(
        serviceContext,
        query.projectId,
        "app",
        "featured-image-studio",
      );
      const response = await generateImageFromDrawing({
        context: serviceContext,
        projectId: query.projectId,
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
  querySchema: projectScopeQuerySchema,
  middleware: [requirePlan("pro")],
  handler: async ({ raw, query, serviceContext, user }) => {
    const body = guessDrawingSchema.parse(await raw.req.parseBody());

    try {
      await requireOptionalProjectCapabilityAccess(
        serviceContext,
        query.projectId,
        "app",
        "featured-image-studio",
      );
      const response = await guessDrawingFromImage({
        context: serviceContext,
        projectId: query.projectId,
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
