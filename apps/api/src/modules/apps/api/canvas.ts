import { AssistantError } from "@ngriffin_uk/polychat-utility-server/errors";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { listCanvasModels } from "~/modules/apps/application/canvas/list-models";
import type { CanvasMode } from "~/modules/apps/application/canvas/types";

const app = new Hono();

const routeLogger = createRouteLogger("apps/canvas");

app.use("/*", (c, next) => {
  routeLogger.info(`Processing canvas route: ${c.req.path}`);

  return next();
});

const listCanvasModelsQuerySchema = z.object({
  mode: z.enum(["image", "video"]).default("image"),
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

export default app;
