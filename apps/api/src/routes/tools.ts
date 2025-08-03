import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { z } from "zod/v4";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { availableFunctions } from "~/services/functions";
import { errorResponseSchema } from "./schemas/shared";
import { toolsResponseSchema } from "./schemas/tools";

const app = new Hono();

const routeLogger = createRouteLogger("TOOLS");

app.use("/*", (c, next) => {
  routeLogger.info(`Processing tools route: ${c.req.path}`);
  return next();
});

app.get(
  "/",
  describeRoute({
    tags: ["tools"],
    summary: "List Tools",
    description: "Lists the currently available tools.",
    responses: {
      200: {
        description: "List of available tools with their details",
        content: {
          "application/json": {
            schema: resolver(toolsResponseSchema),
          },
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
  async (context: Context) => {
    const toolIds = availableFunctions.map((tool) => {
      return {
        id: tool.name,
        name: tool.name,
        description: tool.description,
      };
    });
    return context.json({
      success: true,
      message: "Tools fetched successfully",
      data: toolIds,
    });
  },
);

export default app;
