import { type Context, Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { errorResponseSchema, toolsResponseSchema } from "@assistant/schemas";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { getAvailableTools } from "~/services/tools/toolsOperations";

const app = new Hono();

const routeLogger = createRouteLogger("tools");

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
    const user = context.get("user");
    const isPro = user?.plan_id === "pro";
    const tools = getAvailableTools(isPro);
    return context.json({
      success: true,
      message: "Tools fetched successfully",
      data: tools,
    });
  },
);

export default app;
