import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, Hono } from "hono";

import { errorResponseSchema, checkoutSchema } from "@assistant/schemas";

import {
	cancelSubscription,
	createCheckoutSession,
	getSubscriptionStatus,
	handleStripeWebhook,
	reactivateSubscription,
} from "~/services/subscription";
import { createRouteLogger } from "../middleware/loggerMiddleware";

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
	auth: true,
	handler: async ({ body, serviceContext, user }) =>
		createCheckoutSession(
			serviceContext.env,
			user,
			body.plan_id,
			body.success_url,
			body.cancel_url,
		),
});

addRoute(app, "get", "/subscription", {
	tags: ["stripe"],
	summary: "Get the authenticated user's subscription status",
	responses: {
		200: { description: "Subscription details" },
		404: { description: "No subscription found", schema: errorResponseSchema },
		500: { description: "Server error", schema: errorResponseSchema },
	},
	auth: true,
	handler: async ({ serviceContext, user }) => getSubscriptionStatus(serviceContext.env, user),
});

addRoute(app, "post", "/subscription/cancel", {
	tags: ["stripe"],
	summary: "Cancel the authenticated user's subscription at period end",
	responses: {
		200: { description: "Subscription canceled", schema: errorResponseSchema },
		404: { description: "No subscription found", schema: errorResponseSchema },
		500: { description: "Server error", schema: errorResponseSchema },
	},
	auth: true,
	handler: async ({ serviceContext, user }) => cancelSubscription(serviceContext.env, user),
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
	auth: true,
	handler: async ({ serviceContext, user }) => reactivateSubscription(serviceContext.env, user),
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
