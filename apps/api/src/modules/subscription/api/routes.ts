import {
  billingPortalResponseSchema,
  billingPortalSchema,
  checkoutSchema,
  overageStatusResponseSchema,
  updateSubscriptionSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { defineSingleton } from "~/infrastructure/http/resource";
import {
  cancelSubscription,
  createBillingPortalSession,
  createCheckoutSession,
  getSubscriptionStatus,
  reactivateSubscription,
  setOverageBilling,
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
      summary: "Enable or disable metered overage billing",
      bodySchema: updateSubscriptionSchema,
      responses: {
        200: { description: "Overage billing updated", schema: overageStatusResponseSchema },
      },
      handler: ({ body, serviceContext, user }) =>
        setOverageBilling(serviceContext.env, user, body.overage_enabled),
    })
    .action("cancel", {
      auth: true,
      summary: "Cancel the subscription at period end",
      handler: ({ serviceContext, user }) => cancelSubscription(serviceContext.env, user),
    })
    .action("reactivate", {
      auth: true,
      summary: "Reactivate a subscription scheduled for cancellation",
      handler: ({ serviceContext, user }) => reactivateSubscription(serviceContext.env, user),
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
