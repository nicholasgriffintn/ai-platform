import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";

import { availableFunctions } from "~/services/functions";
import { createRouteLogger } from "../middleware/loggerMiddleware";

const app = new Hono();

const routeLogger = createRouteLogger("TOOLS");

/**
 * Global middleware to add route-specific logging
 */
app.use("/*", (c, next) => {
  routeLogger.info(`Processing tools route: ${c.req.path}`);
  return next();
});

app.get(
  "/",
  describeRoute({
    tags: ["tools"],
    title: "List Tools",
    description: "Lists the currently available tools.",
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
