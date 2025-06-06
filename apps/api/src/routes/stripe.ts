import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import type { z } from "zod";
import { requireAuth } from "~/middleware/auth";
import {
  cancelSubscription,
  createCheckoutSession,
  getSubscriptionStatus,
  handleStripeWebhook,
  reactivateSubscription,
} from "~/services/subscription";
import { createRouteLogger } from "../middleware/loggerMiddleware";
import { AssistantError, ErrorType } from "../utils/errors";
import { errorResponseSchema } from "./schemas/shared";
import { checkoutSchema } from "./schemas/stripe";

const app = new Hono();

const routeLogger = createRouteLogger("STRIPE");

app.use("/*", (c: Context, next) => {
  routeLogger.info(`Processing stripe route: ${c.req.path}`);
  return next();
});

app.post(
  "/checkout",
  describeRoute({
    tags: ["stripe"],
    summary: "Create a Stripe Checkout Session for a subscription",
    requestBody: {
      description: "Plan selection and redirect URLs",
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              plan_id: { type: "string" },
              success_url: { type: "string", format: "uri" },
              cancel_url: { type: "string", format: "uri" },
            },
            required: ["plan_id", "success_url", "cancel_url"],
          },
        },
      },
    },
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
    ) as z.infer<typeof checkoutSchema>;

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
    return c.json(session);
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
    return c.json(status);
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
    return c.json(result);
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
    return c.json(result);
  },
);

app.post("/webhook", async (c: Context) => {
  const signature = c.req.header("stripe-signature");
  const payload = await c.req.text();
  const response = await handleStripeWebhook(c.env, signature, payload);
  return c.json(response);
});

export default app;
