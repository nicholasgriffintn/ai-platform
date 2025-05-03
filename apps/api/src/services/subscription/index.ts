import Stripe from "stripe";
import { FREE_TRIAL_DAYS } from "~/constants/app";
import { Database } from "~/lib/database";
import {
  sendPaymentFailedEmail,
  sendSubscriptionCancellationNoticeEmail,
  sendSubscriptionEmail,
  sendTrialEndingEmail,
  sendUnsubscriptionEmail,
} from "~/services/subscription/emails";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "SUBSCRIPTION_SERVICE" });

function getStripeClient(env: IEnv): Stripe {
  const secret = env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new AssistantError(
      "Stripe secret key not configured",
      ErrorType.CONFIGURATION_ERROR,
    );
  }
  return new Stripe(secret, { apiVersion: "2025-04-30.basil" });
}

export async function createCheckoutSession(
  env: IEnv,
  user: IUser,
  planId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<{ session_id: string; url: string }> {
  const db = Database.getInstance(env);

  if (user.stripe_subscription_id) {
    const stripe = getStripeClient(env);
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

  const plan = await db.getPlanById(planId);
  if (!plan) {
    throw new AssistantError("Plan not found", ErrorType.NOT_FOUND);
  }

  const priceId = (plan as any).stripe_price_id as string;
  const stripe = getStripeClient(env);

  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { user_id: user.id.toString() },
    });
    customerId = customer.id;
    await db.updateUser(user.id, { stripe_customer_id: customerId });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: { trial_period_days: FREE_TRIAL_DAYS },
    metadata: { user_id: user.id.toString() },
  });

  return { session_id: session.id, url: session.url ?? "" };
}

export async function getSubscriptionStatus(
  env: IEnv,
  user: IUser,
): Promise<
  | {
      status: string;
      current_period_end: number | null;
      cancel_at_period_end: boolean;
      trial_end: number | null;
    }
  | Record<string, any>
> {
  const subscriptionId = user.stripe_subscription_id;
  if (!subscriptionId) {
    return {
      status: "inactive",
      current_period_end: null,
      cancel_at_period_end: false,
      trial_end: null,
    };
  }

  const stripe = getStripeClient(env);
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return {
      status: subscription.status,
      days_until_due: subscription.days_until_due,
      cancel_at_period_end: subscription.cancel_at_period_end,
      cancel_at: subscription.cancel_at,
      trial_end: subscription.trial_end,
      currency: subscription.currency,
      items: subscription.items,
    };
  } catch (error: any) {
    if (error.code === "resource_missing") {
      const db = Database.getInstance(env);

      await db.updateUser(user.id, {
        stripe_subscription_id: null,
        plan_id: "free",
      });

      return {
        status: "inactive",
        current_period_end: null,
        cancel_at_period_end: false,
        trial_end: null,
      };
    }
    throw new AssistantError(
      `Stripe API error: ${error.message}`,
      ErrorType.INTERNAL_ERROR,
    );
  }
}

export async function cancelSubscription(
  env: IEnv,
  user: IUser,
): Promise<{
  status: string;
  cancel_at_period_end: boolean;
  days_until_due?: number;
}> {
  const subscriptionId = user.stripe_subscription_id;
  if (!subscriptionId) {
    throw new AssistantError("No active subscription", ErrorType.NOT_FOUND);
  }

  const stripe = getStripeClient(env);
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (subscription.cancel_at_period_end) {
      return {
        status: subscription.status,
        cancel_at_period_end: true,
        days_until_due: subscription.days_until_due,
      };
    }

    const updated = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    if (user.email) {
      try {
        await sendSubscriptionCancellationNoticeEmail(env, user.email);
      } catch (e: any) {
        logger.error(`Failed to send cancellation notice: ${e.message}`);
      }
    }

    return {
      status: updated.status,
      cancel_at_period_end: updated.cancel_at_period_end,
      days_until_due: updated.days_until_due,
    };
  } catch (error: any) {
    if (error.code === "resource_missing") {
      const db = Database.getInstance(env);
      await db.updateUser(user.id, {
        stripe_subscription_id: null,
        plan_id: "free",
      });
      throw new AssistantError("Subscription not found", ErrorType.NOT_FOUND);
    }
    throw new AssistantError(
      `Stripe API error: ${error.message}`,
      ErrorType.INTERNAL_ERROR,
    );
  }
}

export async function reactivateSubscription(
  env: IEnv,
  user: IUser,
): Promise<{ status: string; cancel_at_period_end: boolean }> {
  const subscriptionId = user.stripe_subscription_id;
  if (!subscriptionId) {
    throw new AssistantError("No active subscription", ErrorType.NOT_FOUND);
  }

  const stripe = getStripeClient(env);
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (!subscription.cancel_at_period_end) {
      return { status: subscription.status, cancel_at_period_end: false };
    }

    const updated = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
    return { status: updated.status, cancel_at_period_end: false };
  } catch (error: any) {
    if (error.code === "resource_missing") {
      const db = Database.getInstance(env);
      await db.updateUser(user.id, {
        stripe_subscription_id: null,
        plan_id: "free",
      });
      throw new AssistantError("Subscription not found", ErrorType.NOT_FOUND);
    }
    throw new AssistantError(
      `Stripe API error: ${error.message}`,
      ErrorType.INTERNAL_ERROR,
    );
  }
}

export async function handleStripeWebhook(
  env: IEnv,
  signature: string,
  payload: string,
): Promise<{ received: true }> {
  const sig = signature;
  if (!sig) {
    throw new AssistantError(
      "Missing Stripe signature",
      ErrorType.AUTHENTICATION_ERROR,
    );
  }

  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new AssistantError(
      "Stripe webhook secret not configured",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const stripe = getStripeClient(env);

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

  const db = Database.getInstance(env);
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
            if (user.email) {
              try {
                await sendSubscriptionEmail(env, user.email, "Pro");
              } catch (e: any) {
                logger.error(`Failed to send subscription email: ${e.message}`);
              }
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
          if (user.email) {
            try {
              await sendUnsubscriptionEmail(env, user.email);
            } catch (e: any) {
              logger.error(`Failed to send unsubscription email: ${e.message}`);
            }
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
            await sendPaymentFailedEmail(env, user.email);
          } catch (e: any) {
            logger.error(`Failed to send payment failed email: ${e.message}`);
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
            await sendTrialEndingEmail(env, user.email);
            logger.info(`Trial ending email sent for user ${user.id}`);
          } catch (e: any) {
            logger.error(`Failed to send trial ending email: ${e.message}`);
          }
        }
        break;
      }
    }
  } catch (e: any) {
    logger.error(`Error processing webhook ${event.type}: ${e.message}`);
    throw e;
  }
  return { received: true };
}
