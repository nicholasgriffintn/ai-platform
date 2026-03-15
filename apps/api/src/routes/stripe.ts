import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, Hono } from "hono";

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

addRoute(app, "post", "/checkout", {
	tags: ["stripe"],
	summary: "Create a Stripe Checkout Session for a subscription",
	bodySchema: checkoutSchema,
	responses: {
		200: { description: "Stripe Checkout Session created" },
		400: { description: "Invalid request data", schema: errorResponseSchema },
		500: { description: "Server error", schema: errorResponseSchema },
	},
	middleware: [requireAuth],
	handler: async ({ raw }) =>
		(async (c: Context) => {
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
		})(raw),
});

addRoute(app, "get", "/subscription", {
	tags: ["stripe"],
	summary: "Get the authenticated user's subscription status",
	responses: {
		200: { description: "Subscription details" },
		404: { description: "No subscription found", schema: errorResponseSchema },
		500: { description: "Server error", schema: errorResponseSchema },
	},
	middleware: [requireAuth],
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const user = c.get("user");
			if (!user?.id) {
				throw new AssistantError(
					"Authentication required",
					ErrorType.AUTHENTICATION_ERROR,
				);
			}

			const status = await getSubscriptionStatus(c.env, user);
			return ResponseFactory.success(c, status);
		})(raw),
});

addRoute(app, "post", "/subscription/cancel", {
	tags: ["stripe"],
	summary: "Cancel the authenticated user's subscription at period end",
	responses: {
		200: { description: "Subscription canceled", schema: errorResponseSchema },
		404: { description: "No subscription found", schema: errorResponseSchema },
		500: { description: "Server error", schema: errorResponseSchema },
	},
	middleware: [requireAuth],
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const user = c.get("user");
			if (!user?.id) {
				throw new AssistantError(
					"Authentication required",
					ErrorType.AUTHENTICATION_ERROR,
				);
			}

			const result = await cancelSubscription(c.env, user);
			return ResponseFactory.success(c, result);
		})(raw),
});

addRoute(app, "post", "/subscription/reactivate", {
	tags: ["stripe"],
	summary: "Reactivate a subscription that was scheduled for cancellation",
	responses: {
		200: {
			description: "Subscription reactivated",
			schema: errorResponseSchema,
		},
		404: { description: "No subscription found", schema: errorResponseSchema },
		500: { description: "Server error", schema: errorResponseSchema },
	},
	middleware: [requireAuth],
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const user = c.get("user");
			if (!user?.id) {
				throw new AssistantError(
					"Authentication required",
					ErrorType.AUTHENTICATION_ERROR,
				);
			}
			const result = await reactivateSubscription(c.env, user);
			return ResponseFactory.success(c, result);
		})(raw),
});

addRoute(app, "post", "/webhook", {
	tags: ["stripe"],
	handler: async ({ raw }) => {
		const signature = raw.req.header("stripe-signature");
		const payload = await raw.req.text();
		const response = await handleStripeWebhook(raw.env, signature, payload);
		return raw.json(response);
	},
});

export default app;
