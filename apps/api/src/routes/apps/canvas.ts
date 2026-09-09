import {
  generateCanvasSchema,
  listCanvasGenerationsQuerySchema,
} from "@ngriffin_uk/polychat-schemas/experiences";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/lib/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { requirePlan } from "~/middleware/requirePlan";
import { generateCanvasBatch } from "~/services/apps/canvas/generate";
import { getCanvasGenerationDetails } from "~/services/apps/canvas/get-generation";
import { listCanvasGenerations } from "~/services/apps/canvas/list-generations";
import { listCanvasModels } from "~/services/apps/canvas/list-models";
import type { CanvasMode } from "~/services/apps/canvas/types";
import {
  projectScopeQuerySchema,
  requireOptionalProjectCapabilityAccess,
} from "~/services/workspaces/access";
import { AssistantError } from "~/utils/errors";

const app = new Hono();

const routeLogger = createRouteLogger("apps/canvas");

app.use("/*", (c, next) => {
  routeLogger.info(`Processing canvas route: ${c.req.path}`);

  return next();
});

const listCanvasModelsQuerySchema = z.object({
  mode: z.enum(["image", "video"]).default("image"),
});

const canvasGenerationParamsSchema = z.object({
  id: z.string().min(1),
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
  middleware: [requirePlan("pro")],
  responses: {
    200: { description: "Generation queue results", schema: z.any() },
  },
  handler: async ({ body, serviceContext, user }) => {
    try {
      await requireOptionalProjectCapabilityAccess(
        serviceContext,
        body.projectId,
        "app",
        "featured-image-studio",
      );
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
      await requireOptionalProjectCapabilityAccess(
        serviceContext,
        query.projectId,
        "app",
        "featured-image-studio",
      );
      const generations = await listCanvasGenerations({
        context: serviceContext,
        userId: user.id,
        mode: query.mode,
        projectId: query.projectId,
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
  querySchema: projectScopeQuerySchema,
  responses: {
    200: { description: "Canvas generation details", schema: z.any() },
  },
  handler: async ({ params, query, serviceContext, user }) => {
    try {
      await requireOptionalProjectCapabilityAccess(
        serviceContext,
        query.projectId,
        "app",
        "featured-image-studio",
      );
      const generation = await getCanvasGenerationDetails({
        context: serviceContext,
        userId: user.id,
        generationId: params.id,
        projectId: query.projectId,
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
