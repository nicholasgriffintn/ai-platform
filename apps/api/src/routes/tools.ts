import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { z } from "zod";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { availableFunctions } from "~/services/functions";

const app = new Hono();

const routeLogger = createRouteLogger("TOOLS");

/**
 * Global middleware to add route-specific logging
 */
app.use("/*", (c, next) => {
  routeLogger.info(`Processing tools route: ${c.req.path}`);
  return next();
});

// Define common response schemas
const toolSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
});

const toolsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(toolSchema),
});

const errorResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  error: z.string().optional(),
});

app.get(
  "/",
  describeRoute({
    tags: ["tools"],
    title: "List Tools",
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
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
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
