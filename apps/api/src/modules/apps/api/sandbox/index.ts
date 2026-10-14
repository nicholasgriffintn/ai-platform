import { Hono } from "hono";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { requirePlan } from "~/middleware/requirePlan";

import { registerSandboxConnectionRoutes } from "./connections";

const app = new Hono();
const routeLogger = createRouteLogger("apps/sandbox");

app.use("/*", (c, next) => {
  routeLogger.info(`Processing apps/sandbox route: ${c.req.path}`);

  return next();
});

app.use("/*", requirePlan("pro"));

registerSandboxConnectionRoutes(app);

export default app;
