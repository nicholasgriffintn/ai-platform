import { md } from "~/utils/markdown.js";

export const stripeTagDescription = md`# Stripe

Billing and subscription management endpoints integrating with Stripe.

Authenticated routes rely on shared subscription helpers to enforce plan logic, while the webhook endpoint is designed for direct Stripe callbacks.`;
