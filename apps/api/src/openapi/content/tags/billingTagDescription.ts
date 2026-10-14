import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const billingTagDescription = md`
# Billing

Subscription management backed by Stripe.

- \`GET /billing/subscription\` returns the caller's subscription. \`PATCH\` turns metered overage on or off.
- \`POST /billing/checkout_sessions\` and \`POST /billing/portal_sessions\` return Stripe-hosted URLs to send the person to.
- Cancelling takes effect at the end of the period and can be reversed with \`reactivate\` until then.
`;
