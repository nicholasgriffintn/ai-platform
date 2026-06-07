import { addRoute } from "~/lib/http/routeBuilder";
import { Hono } from "hono";

import { errorResponseSchema, toolsResponseSchema } from "@assistant/schemas";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { getAvailableTools } from "~/services/tools/toolsOperations";

const app = new Hono();

const routeLogger = createRouteLogger("tools");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing tools route: ${c.req.path}`);
	return next();
});

addRoute(app, "get", "/", {
	tags: ["tools"],
	summary: "List Tools",
	description: "Lists the currently available tools.",
	responses: {
		200: {
			description: "List of available tools with their details",
			schema: toolsResponseSchema,
		},
		500: { description: "Server error", schema: errorResponseSchema },
	},
	handler: async ({ user }) => {
		const isPro = user?.plan_id === "pro";
		return getAvailableTools(isPro, Boolean(user?.id));
	},
});

export default app;
