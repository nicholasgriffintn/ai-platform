import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi";
import { z } from "zod/v4";

import { requireAuth } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { DynamicAppResponseRepository } from "~/repositories/DynamicAppResponseRepository";
import {
  executeDynamicApp,
  getDynamicAppById,
  getDynamicApps,
} from "~/services/dynamic-apps";
import { appSchema } from "~/types/app-schema";
import type { IRequest } from "~/types/chat";
import { getLogger } from "~/utils/logger";
import type { IUser } from "../types";
import { appDataSchema } from "./schemas/app-data";
import { appInfoSchema } from "./schemas/apps";
import { errorResponseSchema } from "./schemas/shared";

const logger = getLogger({ prefix: "DYNAMIC_APPS" });

const dynamicApps = new Hono();

const routeLogger = createRouteLogger("DYNAMIC_APPS");

dynamicApps.use("*", requireAuth);

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
            schema: resolver(z.array(appInfoSchema)),
          },
        },
      },
      401: {
        description: "Authentication required",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
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
  "/responses",
  describeRoute({
    summary: "List stored dynamic-app responses for user",
    tags: ["Dynamic Apps"],
    parameters: [
      {
        name: "appId",
        in: "query",
        required: false,
        schema: { type: "string" },
      },
    ],
    responses: {
      200: {
        description: "Array of responses",
        content: {
          "application/json": {
            schema: resolver(z.array(appDataSchema)),
          },
        },
      },
      401: {
        description: "Authentication required",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
    },
  }),
  async (c: Context) => {
    const user = c.get("user") as IUser;
    const appId = c.req.query("appId");

    const repo = new DynamicAppResponseRepository(c.env);
    const list = await repo.listResponsesForUser(user.id, appId);
    return c.json(list);
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
        schema: { type: "string" },
      },
    ],
    responses: {
      200: {
        description: "Dynamic app schema",
        content: {
          "application/json": {
            schema: resolver(appSchema),
          },
        },
      },
      400: {
        description: "Bad request",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
      401: {
        description: "Authentication required",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
      404: {
        description: "App not found",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
    },
  }),
  async (c: Context) => {
    const _user = c.get("user") as IUser | undefined;

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
        schema: { type: "string" },
      },
    ],
    requestBody: {
      description: "Form data for the app",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
    },
    responses: {
      200: {
        description: "App execution result",
        content: {
          "application/json": {
            schema: resolver(z.string()),
          },
        },
      },
      400: {
        description: "Invalid form data",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
      401: {
        description: "Authentication required",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
      404: {
        description: "App not found",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
      500: {
        description: "Server error",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
    },
  }),
  async (c: Context) => {
    const id = c.req.param("id");
    if (!id) {
      return c.json({ error: "App ID is required" }, 400);
    }

    const user = c.get("user");

    if (!user?.id) {
      return c.json(
        {
          response: {
            status: "error",
            message: "User not authenticated",
          },
        },
        401,
      );
    }

    if (user.plan_id !== "pro") {
      return c.json(
        {
          response: {
            status: "error",
            message: "User is not on pro plan",
          },
        },
        401,
      );
    }

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
      logger.error(`Error executing app ${id}:`, { error });
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

dynamicApps.get(
  "/responses/:responseId",
  describeRoute({
    summary: "Get stored dynamic-app response",
    description:
      "Retrieve a stored dynamic-app response by its `id` (response_id)",
    tags: ["Dynamic Apps"],
    parameters: [
      {
        name: "responseId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
    ],
    responses: {
      200: {
        description: "Stored dynamic-app response",
        content: {
          "application/json": {
            schema: resolver(z.object({ response: z.any() })),
          },
        },
      },
      400: {
        description: "Bad request",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
      401: {
        description: "Authentication required",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
      404: {
        description: "Response not found",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
    },
  }),
  async (c: Context) => {
    const responseId = c.req.param("responseId");
    if (!responseId) {
      return c.json({ error: "responseId is required" }, 400);
    }
    const repo = new DynamicAppResponseRepository(c.env);
    const data = await repo.getResponseById(responseId);
    if (!data) {
      return c.json({ error: "Response not found" }, 404);
    }
    return c.json({ response: data });
  },
);

export default dynamicApps;
