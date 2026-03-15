import { Hono } from "hono";

import { requirePlan } from "~/middleware/requirePlan";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { registerSandboxConnectionRoutes } from "./connections";
import { registerSandboxRunRoutes } from "./runs";

const app = new Hono();
const routeLogger = createRouteLogger("apps/sandbox");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing apps/sandbox route: ${c.req.path}`);
	return next();
});

app.use("/*", requirePlan("pro"));

registerSandboxConnectionRoutes(app);
registerSandboxRunRoutes(app);

export default app;
