import { type Context, Hono } from "hono";
import { describeRoute, resolver, validator as zValidator } from "hono-openapi";
import {
	planParamsSchema,
	planResponseSchema,
	plansResponseSchema,
	errorResponseSchema,
} from "@assistant/schemas";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { getPlanDetails, listPlans } from "~/services/plans";
import type { IEnv } from "~/types";

const app = new Hono();
const routeLogger = createRouteLogger("plans");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing plans route: ${c.req.path}`);
	return next();
});

app.get(
	"/",
	describeRoute({
		tags: ["plans"],
		summary: "List subscription plans",
		responses: {
			200: {
				description: "Subscription plans",
				content: {
					"application/json": { schema: resolver(plansResponseSchema) },
				},
			},
		},
	}),
	async (c: Context) => {
		const plans = await listPlans(c.env as IEnv);
		return ResponseFactory.success(c, plans);
	},
);

app.get(
	"/:id",
	describeRoute({
		tags: ["plans"],
		summary: "Get subscription plan",
		responses: {
			200: {
				description: "Plan found",
				content: {
					"application/json": { schema: resolver(planResponseSchema) },
				},
			},
			404: {
				description: "Not found",
				content: {
					"application/json": { schema: resolver(errorResponseSchema) },
				},
			},
		},
	}),
	zValidator("param", planParamsSchema),
	async (c: Context) => {
		const { id } = c.req.valid("param" as never) as { id: string };
		const plan = await getPlanDetails(c.env as IEnv, id);
		return ResponseFactory.success(c, plan);
	},
);

export default app;
