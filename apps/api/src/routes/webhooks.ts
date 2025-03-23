import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { webhookAuth } from "../middleware/auth";
import { createRouteLogger } from "../middleware/loggerMiddleware";
import { handleReplicateWebhook } from "../services/webhooks/replicate";
import type { IBody, IEnv } from "../types";
import { messageSchema } from "./schemas/shared";
import {
	replicateWebhookJsonSchema,
	replicateWebhookQuerySchema,
} from "./schemas/webhooks";

const app = new Hono();

const routeLogger = createRouteLogger("WEBHOOKS");

/**
 * Global middleware to add route-specific logging
 */
app.use("/*", (c, next) => {
	routeLogger.info(`Processing webhooks route: ${c.req.path}`);
	return next();
});

/**
 * Global middleware to check the WEBHOOK_SECRET
 */
app.use("/*", webhookAuth);

app.post(
	"/replicate",
	describeRoute({
		tags: ["webhooks"],
		description: "Respond to a replicate webhook request",
		responses: {
			200: {
				description: "Response containing the status of the webhook request",
				content: {
					"application/json": {
						schema: resolver(messageSchema),
					},
				},
			},
		},
	}),
	zValidator("query", replicateWebhookQuerySchema),
	zValidator("json", replicateWebhookJsonSchema),
	async (context: Context) => {
		const { completion_id } = context.req.valid("query" as never) as {
			completion_id: string;
		};

		const body = context.req.valid("json" as never) as IBody;

		const data = await handleReplicateWebhook(
			{
				env: context.env as IEnv,
				request: body,
			},
			completion_id,
		);

		return context.json(data);
	},
);

export default app;
