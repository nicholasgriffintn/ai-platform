import {
  billingPortalResponseSchema,
  billingPortalSchema,
  checkoutSchema,
  subscriptionUpdateResponseSchema,
  updateSubscriptionSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { defineSingleton } from "~/infrastructure/http/resource";
import {
  createBillingPortalSession,
  createCheckoutSession,
  getSubscriptionStatus,
  updateSubscription,
} from "~/modules/subscription/application";

const app = new Hono();

defineSingleton(app, { path: "/subscription", tags: ["billing"] }, (subscription) => {
  subscription
    .read({
      auth: true,
      summary: "Get the caller's subscription",
      responses: { 200: { description: "Subscription details" } },
      handler: ({ serviceContext, user }) => getSubscriptionStatus(serviceContext.env, user),
    })
    .update({
      auth: true,
      summary: "Update the subscription",
      description:
        "Turns metered overage billing on or off, or schedules (cancel_at_period_end: true) or withdraws (false) cancellation at period end.",
      bodySchema: updateSubscriptionSchema,
      responses: {
        200: { description: "Subscription updated", schema: subscriptionUpdateResponseSchema },
      },
      handler: ({ body, serviceContext, user }) =>
        updateSubscription(serviceContext.env, user, body),
    });
});

defineSingleton(app, { path: "/checkout_sessions", tags: ["billing"] }, (checkout) => {
  checkout.create({
    auth: true,
    summary: "Start a Stripe Checkout session for a subscription",
    bodySchema: checkoutSchema,
    handler: ({ body, serviceContext, user }) =>
      createCheckoutSession(
        serviceContext.env,
        user,
        body.plan_id,
        body.success_url,
        body.cancel_url,
      ),
  });
});

defineSingleton(app, { path: "/portal_sessions", tags: ["billing"] }, (portal) => {
  portal.create({
    auth: true,
    summary: "Open a Stripe billing portal session",
    bodySchema: billingPortalSchema,
    responses: {
      200: { description: "Billing portal session", schema: billingPortalResponseSchema },
    },
    handler: ({ body, serviceContext, user }) =>
      createBillingPortalSession(serviceContext.env, user, body.return_url),
  });
});

export default app;
