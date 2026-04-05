import { Hono } from "hono";

import { requirePlan } from "~/middleware/requirePlan";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { registerDynamicWorkerRunRoutes } from "./runs";

const app = new Hono();
const routeLogger = createRouteLogger("apps/dynamic-workers");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing apps/dynamic-workers route: ${c.req.path}`);
	return next();
});

app.use("/*", requirePlan("pro"));

registerDynamicWorkerRunRoutes(app);

export default app;
