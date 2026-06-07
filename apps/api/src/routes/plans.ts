import { addRoute } from "~/lib/http/routeBuilder";
import { Hono } from "hono";

import {
	planParamsSchema,
	planResponseSchema,
	plansResponseSchema,
	errorResponseSchema,
} from "@assistant/schemas";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { getPlanDetails, listPlans } from "~/services/plans";

const app = new Hono();
const routeLogger = createRouteLogger("plans");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing plans route: ${c.req.path}`);
	return next();
});

addRoute(app, "get", "/", {
	tags: ["plans"],
	summary: "List subscription plans",
	responses: {
		200: { description: "Subscription plans", schema: plansResponseSchema },
	},
	handler: async ({ serviceContext }) => listPlans(serviceContext.env),
});

addRoute(app, "get", "/:id", {
	tags: ["plans"],
	summary: "Get subscription plan",
	paramSchema: planParamsSchema,
	responses: {
		200: { description: "Plan found", schema: planResponseSchema },
		404: { description: "Not found", schema: errorResponseSchema },
	},
	handler: async ({ params, serviceContext }) => getPlanDetails(serviceContext.env, params.id),
});

export default app;
