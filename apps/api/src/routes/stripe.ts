import { type Context, Hono } from "hono";
import { describeRoute, resolver, validator as zValidator } from "hono-openapi";
import { errorResponseSchema, checkoutSchema } from "@assistant/schemas";

import { requireAuth } from "~/middleware/auth";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import {
	cancelSubscription,
	createCheckoutSession,
	getSubscriptionStatus,
	handleStripeWebhook,
	reactivateSubscription,
} from "~/services/subscription";
import { createRouteLogger } from "../middleware/loggerMiddleware";
import { AssistantError, ErrorType } from "../utils/errors";

const app = new Hono();

const routeLogger = createRouteLogger("stripe");

app.use("/*", (c: Context, next) => {
	routeLogger.info(`Processing stripe route: ${c.req.path}`);
	return next();
});

app.post(
	"/checkout",
	describeRoute({
		tags: ["stripe"],
		summary: "Create a Stripe Checkout Session for a subscription",
		responses: {
			200: {
				description: "Stripe Checkout Session created",
				content: { "application/json": {} },
			},
			400: {
				description: "Invalid request data",
				content: {
					"application/json": { schema: resolver(errorResponseSchema) },
				},
			},
			500: {
				description: "Server error",
				content: {
					"application/json": { schema: resolver(errorResponseSchema) },
				},
			},
		},
	}),
	zValidator("json", checkoutSchema),
	requireAuth,
	async (c: Context) => {
		const { plan_id, success_url, cancel_url } = c.req.valid(
			"json" as never,
		) as {
			plan_id: string;
			success_url: string;
			cancel_url: string;
		};

		const user = c.get("user");
		if (!user?.id) {
			throw new AssistantError(
				"Authentication required",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}

		const env = c.env;

		const session = await createCheckoutSession(
			env,
			user,
			plan_id,
			success_url,
			cancel_url,
		);
		return ResponseFactory.success(c, session);
	},
);

app.get(
	"/subscription",
	describeRoute({
		tags: ["stripe"],
		summary: "Get the authenticated user's subscription status",
		responses: {
			200: {
				description: "Subscription details",
				content: { "application/json": {} },
			},
			404: {
				description: "No subscription found",
				content: {
					"application/json": { schema: resolver(errorResponseSchema) },
				},
			},
			500: {
				description: "Server error",
				content: {
					"application/json": { schema: resolver(errorResponseSchema) },
				},
			},
		},
	}),
	requireAuth,
	async (c: Context) => {
		const user = c.get("user");
		if (!user?.id) {
			throw new AssistantError(
				"Authentication required",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}

		const status = await getSubscriptionStatus(c.env, user);
		return ResponseFactory.success(c, status);
	},
);

app.post(
	"/subscription/cancel",
	describeRoute({
		tags: ["stripe"],
		summary: "Cancel the authenticated user's subscription at period end",
		responses: {
			200: {
				description: "Subscription canceled",
				content: {
					"application/json": { schema: resolver(errorResponseSchema) },
				},
			},
			404: {
				description: "No subscription found",
				content: {
					"application/json": { schema: resolver(errorResponseSchema) },
				},
			},
			500: {
				description: "Server error",
				content: {
					"application/json": { schema: resolver(errorResponseSchema) },
				},
			},
		},
	}),
	requireAuth,
	async (c: Context) => {
		const user = c.get("user");
		if (!user?.id) {
			throw new AssistantError(
				"Authentication required",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}

		const result = await cancelSubscription(c.env, user);
		return ResponseFactory.success(c, result);
	},
);

app.post(
	"/subscription/reactivate",
	describeRoute({
		tags: ["stripe"],
		summary: "Reactivate a subscription that was scheduled for cancellation",
		responses: {
			200: {
				description: "Subscription reactivated",
				content: {
					"application/json": { schema: resolver(errorResponseSchema) },
				},
			},
			404: {
				description: "No subscription found",
				content: {
					"application/json": { schema: resolver(errorResponseSchema) },
				},
			},
			500: {
				description: "Server error",
				content: {
					"application/json": { schema: resolver(errorResponseSchema) },
				},
			},
		},
	}),
	requireAuth,
	async (c: Context) => {
		const user = c.get("user");
		if (!user?.id) {
			throw new AssistantError(
				"Authentication required",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}
		const result = await reactivateSubscription(c.env, user);
		return ResponseFactory.success(c, result);
	},
);

app.post("/webhook", async (c: Context) => {
	const signature = c.req.header("stripe-signature");
	const payload = await c.req.text();
	const response = await handleStripeWebhook(c.env, signature, payload);
	return c.json(response);
});

export default app;
