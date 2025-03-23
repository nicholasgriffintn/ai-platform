import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";

import { requireAuth } from "../middleware/auth";
import type { IEnv, SearchOptions } from "../types";

import { createRouteLogger } from "../middleware/loggerMiddleware";
import { handleWebSearch } from "../services/search/web";
import { searchWebSchema } from "./schemas/search";

const app = new Hono();

const routeLogger = createRouteLogger("SEARCH");

/**
 * Global middleware to add route-specific logging
 */
app.use("/*", (c, next) => {
	routeLogger.info(`Processing search route: ${c.req.path}`);
	return next();
});

/**
 * Global middleware to check authentication
 */
app.use("/*", requireAuth);

app.post(
	"/web",
	describeRoute({
		tags: ["search"],
		title: "Web search",
		description: "Searches the web for the input query.",
		responses: {
			200: {
				description: "Response",
				content: {
					"application/json": {
						schema: resolver(z.object({})),
					},
				},
			},
		},
	}),
	zValidator("json", searchWebSchema),
	async (context: Context) => {
		const body = context.req.valid("json" as never) as {
			query: string;
			provider?: "serper" | "tavily";
			options?: SearchOptions;
		};
		const user = context.get("user");

		const response = await handleWebSearch({
			env: context.env as IEnv,
			query: body.query,
			user,
			provider: body.provider,
			options: body.options,
		});

		return context.json(response);
	},
);

export default app;
