# Operate Stripe billing

Polychat cannot create a Checkout Session from a Stripe secret alone. Each paid plan needs a recurring
Stripe Price, and the matching D1 `plans` row must hold that Price ID. Checkout fails closed before creating
a Stripe Customer when this value is absent.

Stripe buys entitlement and overage, not metering. Credit allowances apply whether or not Stripe is
configured, and an account with overage off simply pauses at the end of its reserve until the calendar
month resets. Without Stripe the billing portal and overage controls hide themselves rather than erroring.

## Configure an environment

- Create or select the Pro product and its recurring Price in the matching Stripe test or live mode.
- Copy the `price_...` identifier, not the Product identifier, into `plans.stripe_price_id` for `id = 'pro'`
  in that environment's D1 database.
- Configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as Worker secrets. Never put their values in
  Wrangler variables or tracked files.
- Register the environment's `/stripe/webhook` endpoint in Stripe for `checkout.session.completed`,
  `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`,
  `invoice.paid`, and `customer.subscription.trial_will_end`.
- Keep test keys, test Prices, and test webhook secrets together. Stripe rejects a Price from the other
  mode even when the identifier looks valid.

For local development, apply migrations first, then update the local D1 row with the test Price ID. For a
remote environment, inspect the target before changing the row and treat the D1 update as a production
write. Do not add an unknown Price ID to a migration: Stripe objects differ by account and mode.

Stripe cannot send hosted webhooks directly to a local Worker. During local subscription testing, run the
Stripe CLI listener against the same sandbox account and forward events to
`http://api.polychat.app/stripe/webhook`. Put the listener's `whsec_...` value in the local
`STRIPE_WEBHOOK_SECRET`, then restart the API so it reads the value. The subscription-status route recovers
an active or trialling subscription from Stripe when the Checkout completion webhook is delayed, but keep
the listener running to exercise cancellation, invoice, and trial lifecycle events.

## Meter overage

Overage is opt-in and off by default. When a person turns it on, spend past the reserve accrues as overage
credits and reaches Stripe through a Billing Meter — one hourly `stripe_usage_sync` batch per customer, never
one event per usage event. Configure the meter, the metered price, and the plan's `stripe_meter_id` and
`overage_price_id` before offering it; see [configuration.md](../configuration.md).

- `POST /stripe/overage` requires an entitled subscription and a payment method, and adds or removes the
  plan's metered subscription item in both directions.
- A plan without `stripe_meter_id` is skipped by the sync, so its overage accrues in D1 and is never billed.
  Check that first when an invoice looks short.
- A downgrade to Free switches overage off. Confirm the flag on the current period's balance after a plan
  change rather than assuming the subscription item alone governs it.

## Give staff ongoing Pro access

Use the normal Pro subscription with a Stripe-managed discount. This keeps activation, revocation,
invoices, and webhook-driven entitlement on the same path as paid Pro.

- In Stripe, create a coupon named `Staff Pro` with `100%` off and duration `Forever`. Restrict it to the
  Pro product when that product should be its only use.
- Have the staff member sign in to Polychat, choose **Upgrade to Pro**, and close Checkout. This creates and
  records their Stripe Customer before any subscription exists.
- In Stripe, create a promotion code for that coupon. Restrict it to that exact Customer and set one
  redemption. Use a generated code rather than a shared memorable code.
- Have the staff member start **Upgrade to Pro** again and enter the promotion code in Checkout. Checkout
  still collects a payment method because the Pro plan includes a trial and the general paid flow must
  remain chargeable when no staff discount is present.
- Confirm Stripe shows an active or trialling subscription with the forever discount and Polychat reports
  Pro after the signed webhook arrives.

Do not create one unrestricted `STAFF` code. A leaked code would be a public permanent discount. Stripe
supports customer restrictions on promotion codes and checks them at redemption, so use one code per
Customer.

## Revoke staff access

Cancel the staff subscription in Stripe. The normal `customer.subscription.deleted` or non-entitled
status webhook returns the account to Free. Archiving the promotion code only prevents future redemption;
it does not remove a discount already attached to a subscription.

If someone should keep Pro but no longer receive a free subscription, remove the discount or replace the
subscription deliberately in Stripe. Confirm the next invoice and entitlement state rather than assuming
that archiving the code changes an existing subscription.

## Diagnose Checkout

- `Stripe price ID not configured for plan pro`: populate the Pro plan row in the D1 database used by the
  running API.
- `Checkout return URLs must use the configured app origin`: make the web app send success and cancellation
  URLs on `APP_BASE_URL`; do not add an external redirect exception.
- Stripe says the Price does not exist: check that the Price and secret key use the same test or live mode
  and the same Stripe account.
- Checkout succeeds but Pro does not activate: inspect webhook delivery, signature-secret selection, and
  the Stripe Customer ID stored on the Polychat user. Loading Billing should reconcile an active or
  trialling subscription when Stripe has the subscription but D1 has not stored its ID.
- A cancelled or failed subscription still appears Pro: replay or inspect the relevant subscription and
  invoice webhook, then confirm its delivery received a successful response.
