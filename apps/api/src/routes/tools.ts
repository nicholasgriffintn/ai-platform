import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, Hono } from "hono";

import { errorResponseSchema, toolsResponseSchema } from "@assistant/schemas";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
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
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const user = context.get("user");
			const isPro = user?.plan_id === "pro";
			const tools = getAvailableTools(isPro);
			return ResponseFactory.success(context, tools);
		})(raw),
});

export default app;
