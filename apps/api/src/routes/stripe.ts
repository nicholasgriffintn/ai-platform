import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import Stripe from "stripe";
import { z } from "zod";
import { FREE_TRIAL_DAYS } from "~/constants/app";
import { Database } from "~/lib/database";
import { requireAuth } from "~/middleware/auth";
import {
  sendPaymentFailedEmail,
  sendSubscriptionCancellationNoticeEmail,
  sendSubscriptionEmail,
  sendTrialEndingEmail,
  sendUnsubscriptionEmail,
} from "~/services/subscription/emails";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "STRIPE_ROUTES" });

const app = new Hono();

const checkoutSchema = z.object({
  plan_id: z.string(),
  success_url: z.string().url(),
  cancel_url: z.string().url(),
});

function getStripeClient(ctx: Context): Stripe {
  const secret = ctx.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new AssistantError(
      "Stripe secret key not configured",
      ErrorType.CONFIGURATION_ERROR,
    );
  }
  return new Stripe(secret, { apiVersion: "2025-03-31.basil" });
}

app.post(
  "/checkout",
  describeRoute({
    tags: ["stripe"],
    summary: "Create a Stripe Checkout Session for a subscription",
    requestBody: {
      description: "Plan selection and redirect URLs",
      required: true,
      content: {
        "application/json": { schema: resolver(checkoutSchema) },
      },
    },
    responses: {
      200: {
        description: "Stripe Checkout Session created",
        content: { "application/json": {} },
      },
      400: {
        description: "Invalid request data",
        content: { "application/json": {} },
      },
      500: { description: "Server error", content: { "application/json": {} } },
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

    const db = Database.getInstance(c.env);

    if (user.stripe_subscription_id) {
      const stripe = getStripeClient(c);
      const subscription = await stripe.subscriptions.retrieve(
        user.stripe_subscription_id,
      );

      if (["active", "trialing"].includes(subscription.status)) {
        throw new AssistantError(
          "User already has an active subscription",
          ErrorType.CONFLICT_ERROR,
        );
      }
    }

    const plan = await db.getPlanById(plan_id);

    if (!plan) {
      throw new AssistantError("Plan not found", ErrorType.NOT_FOUND);
    }

    const priceId = (plan as any).stripe_price_id as string;
    const stripe = getStripeClient(c);

    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: (user as any).email,
        metadata: { user_id: user.id.toString() },
      });

      customerId = customer.id;

      await db.updateUser(user.id, { stripe_customer_id: customerId });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url,
      cancel_url,
      subscription_data: {
        trial_period_days: FREE_TRIAL_DAYS,
      },
      metadata: {
        user_id: user.id.toString(),
      },
    });

    return c.json({
      session_id: session.id,
      url: session.url,
    });
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
        content: { "application/json": {} },
      },
      500: { description: "Server error", content: { "application/json": {} } },
    },
  }),
  requireAuth,
  async (c: Context) => {
    const user = c.get("user");
    const subscriptionId = user?.stripe_subscription_id;

    if (!subscriptionId) {
      return c.json({
        status: "inactive",
        current_period_end: null,
        cancel_at_period_end: false,
        trial_end: null,
      });
    }

    const stripe = getStripeClient(c);

    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      return c.json({
        status: subscription.status,
        days_until_due: subscription.days_until_due,
        cancel_at_period_end: subscription.cancel_at_period_end,
        cancel_at: subscription.cancel_at,
        trial_end: subscription.trial_end,
        currency: subscription.currency,
        items: subscription.items,
      });
    } catch (error: any) {
      if (error.code === "resource_missing") {
        await Database.getInstance(c.env).updateUser(user.id, {
          stripe_subscription_id: null,
          plan_id: "free",
        });

        return c.json({
          status: "inactive",
          current_period_end: null,
          cancel_at_period_end: false,
          trial_end: null,
        });
      }
      throw new AssistantError(
        `Stripe API error: ${error.message}`,
        ErrorType.INTERNAL_ERROR,
      );
    }
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
        content: { "application/json": {} },
      },
      404: {
        description: "No subscription found",
        content: { "application/json": {} },
      },
      500: { description: "Server error", content: { "application/json": {} } },
    },
  }),
  requireAuth,
  async (c: Context) => {
    const user = c.get("user");
    const subscriptionId = (user as any)?.stripe_subscription_id;

    if (!subscriptionId) {
      throw new AssistantError("No active subscription", ErrorType.NOT_FOUND);
    }

    const stripe = getStripeClient(c);

    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      if (subscription.cancel_at_period_end) {
        return c.json({
          status: subscription.status,
          cancel_at_period_end: true,
          days_until_due: subscription.days_until_due,
        });
      }

      const updatedSubscription = await stripe.subscriptions.update(
        subscriptionId,
        {
          cancel_at_period_end: true,
        },
      );

      if (user.email) {
        try {
          await sendSubscriptionCancellationNoticeEmail(c, user.email);
        } catch (error: any) {
          logger.error(
            `Failed to send cancellation notification: ${error.message}`,
          );
          // TODO: Queue this to retry later
        }
      }

      return c.json({
        status: updatedSubscription.status,
        cancel_at_period_end: updatedSubscription.cancel_at_period_end,
        days_until_due: updatedSubscription.days_until_due,
      });
    } catch (error: any) {
      if (error.code === "resource_missing") {
        await Database.getInstance(c.env).updateUser(user.id, {
          stripe_subscription_id: null,
          plan_id: "free",
        });

        throw new AssistantError("Subscription not found", ErrorType.NOT_FOUND);
      }
      // TODO: Queue this to retry later
      throw new AssistantError(
        `Stripe API error: ${error.message}`,
        ErrorType.INTERNAL_ERROR,
      );
    }
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
        content: { "application/json": {} },
      },
      404: {
        description: "No subscription found",
        content: { "application/json": {} },
      },
      500: { description: "Server error", content: { "application/json": {} } },
    },
  }),
  requireAuth,
  async (c: Context) => {
    const user = c.get("user");
    const subscriptionId = (user as any)?.stripe_subscription_id;

    if (!subscriptionId) {
      throw new AssistantError("No active subscription", ErrorType.NOT_FOUND);
    }

    const stripe = getStripeClient(c);

    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      if (!subscription.cancel_at_period_end) {
        return c.json({
          status: subscription.status,
          cancel_at_period_end: false,
        });
      }

      const updatedSubscription = await stripe.subscriptions.update(
        subscriptionId,
        {
          cancel_at_period_end: false,
        },
      );

      return c.json({
        status: updatedSubscription.status,
        cancel_at_period_end: false,
      });
    } catch (error: any) {
      if (error.code === "resource_missing") {
        await Database.getInstance(c.env).updateUser(user.id, {
          stripe_subscription_id: null,
          plan_id: "free",
        });

        throw new AssistantError("Subscription not found", ErrorType.NOT_FOUND);
      }
      // TODO: Queue this to retry later
      throw new AssistantError(
        `Stripe API error: ${error.message}`,
        ErrorType.INTERNAL_ERROR,
      );
    }
  },
);

app.post("/webhook", async (c: Context) => {
  const sig = c.req.header("stripe-signature");

  if (!sig) {
    throw new AssistantError(
      "Missing Stripe signature",
      ErrorType.AUTHENTICATION_ERROR,
    );
  }

  const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new AssistantError(
      "Stripe webhook secret not configured",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const payload = await c.req.text();
  const stripe = getStripeClient(c);

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      sig,
      webhookSecret,
    );
  } catch (err: any) {
    logger.error(`Webhook signature verification failed: ${err.message}`);
    throw new AssistantError(
      "Invalid webhook signature",
      ErrorType.AUTHENTICATION_ERROR,
    );
  }

  const db = Database.getInstance(c.env);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (customerId && subscriptionId) {
          const user = await db.getUserByStripeCustomerId(customerId);

          if (user?.id) {
            await db.updateUser(user.id, {
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              plan_id: "pro",
            });

            try {
              if (user.email) {
                await sendSubscriptionEmail(c, user.email, "Pro");
              }
            } catch (error: any) {
              logger.error(
                `Failed to send subscription email: ${error.message}`,
              );
            }
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const user = await db.getUserByStripeCustomerId(customerId);

        if (user?.id) {
          await db.updateUser(user.id, {
            stripe_subscription_id: subscription.id,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const user = await db.getUserByStripeCustomerId(customerId);

        if (user?.id) {
          await db.updateUser(user.id, {
            stripe_subscription_id: null,
            plan_id: "free",
          });

          try {
            if (user.email) {
              await sendUnsubscriptionEmail(c, user.email);
            }
          } catch (error: any) {
            logger.error(`Failed to send cancellation email: ${error.message}`);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const user = await db.getUserByStripeCustomerId(customerId);

        if (user?.id && user.email) {
          try {
            await sendPaymentFailedEmail(c, user.email);
          } catch (error: any) {
            logger.error(
              `Failed to send payment failed email: ${error.message}`,
            );
          }
        }
        break;
      }

      case "customer.subscription.trial_will_end": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const user = await db.getUserByStripeCustomerId(customerId);

        if (user?.id && user.email) {
          try {
            await sendTrialEndingEmail(c, user.email);
            logger.info(
              `Trial ending notification sent for user ${user.id} with subscription ${subscription.id}`,
            );
          } catch (error: any) {
            logger.error(
              `Failed to send trial ending notification: ${error.message}`,
            );
          }
        }
        break;
      }
    }
  } catch (error: any) {
    logger.error(`Error processing webhook ${event.type}: ${error.message}`);

    // TODO: Queue this to retry later and then don't throw an error
    throw error;
  }

  return c.json({ received: true });
});

export default app;
