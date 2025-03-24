import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";

import { requireAuth } from "../middleware/auth";
import { createRouteLogger } from "../middleware/loggerMiddleware";
import {
  executeDynamicApp,
  getDynamicAppById,
  getDynamicApps,
} from "../services/dynamic-apps";
import { appSchema } from "../types/app-schema";
import type { IRequest } from "../types/chat";

const dynamicApps = new Hono();

const routeLogger = createRouteLogger("DYNAMIC_APPS");

dynamicApps.use("*", requireAuth);

/**
 * Global middleware to add route-specific logging
 */
dynamicApps.use("*", (c, next) => {
  routeLogger.info(`Processing dynamic-apps route: ${c.req.path}`);
  return next();
});

dynamicApps.get(
  "/",
  describeRoute({
    summary: "List all available dynamic apps",
    description:
      "Returns a list of all registered dynamic apps with their basic information",
    tags: ["Dynamic Apps"],
    responses: {
      200: {
        description: "List of dynamic apps",
        content: {
          "application/json": {
            schema: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                description: z.string(),
                icon: z.string().optional(),
                category: z.string().optional(),
              }),
            ),
          },
        },
      },
    },
  }),
  async (c) => {
    const apps = await getDynamicApps();
    return c.json(apps);
  },
);

dynamicApps.get(
  "/:id",
  describeRoute({
    summary: "Get dynamic app schema",
    description: "Returns the complete schema for a specific dynamic app",
    tags: ["Dynamic Apps"],
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: z.string(),
      },
    ],
    responses: {
      200: {
        description: "Dynamic app schema",
        content: {
          "application/json": {
            schema: appSchema,
          },
        },
      },
      404: {
        description: "App not found",
      },
    },
  }),
  async (c: Context) => {
    const id = c.req.param("id");
    if (!id) {
      return c.json({ error: "App ID is required" }, 400);
    }

    const app = await getDynamicAppById(id);

    if (!app) {
      return c.json({ error: "App not found" }, 404);
    }

    return c.json(app);
  },
);

dynamicApps.post(
  "/:id/execute",
  describeRoute({
    summary: "Execute dynamic app",
    description: "Executes a dynamic app with the provided form data",
    tags: ["Dynamic Apps"],
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: z.string(),
      },
    ],
    requestBody: {
      description: "Form data for the app",
      content: {
        "application/json": {
          schema: z.record(z.any()),
        },
      },
    },
    responses: {
      200: {
        description: "App execution result",
        content: {
          "application/json": {
            schema: z.record(z.any()),
          },
        },
      },
      400: {
        description: "Invalid form data",
      },
      404: {
        description: "App not found",
      },
      500: {
        description: "Execution error",
      },
    },
  }),
  async (c: Context) => {
    const id = c.req.param("id");
    if (!id) {
      return c.json({ error: "App ID is required" }, 400);
    }

    const user = c.get("user");

    const formData = await c.req.json();

    try {
      const app = await getDynamicAppById(id);

      if (!app) {
        return c.json({ error: "App not found" }, 404);
      }

      const url = new URL(c.req.url);
      const host = url.host;

      const req: IRequest = {
        app_url: `https://${host}`,
        env: c.env,
        request: {
          completion_id: crypto.randomUUID(),
          input: "dynamic-app-execution",
          date: new Date().toISOString(),
        },
        user,
      };

      const result = await executeDynamicApp(id, formData, req);
      return c.json(result);
    } catch (error) {
      console.error(`Error executing app ${id}:`, error);
      return c.json(
        {
          error: "Failed to execute app",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  },
);

export default dynamicApps;
