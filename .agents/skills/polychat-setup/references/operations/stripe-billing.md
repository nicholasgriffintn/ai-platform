# Operate Stripe billing

A Stripe secret alone cannot configure Checkout. Each paid plan needs a recurring Price ID in its D1 `plans.stripe_price_id` row. Metering works independently of Stripe; billing adds subscription entitlement and optional overage.

## Configure an environment

- Create the plan's product and recurring Price in the matching Stripe test or live account. Store the Price ID, not Product ID, on the plan row.
- Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as Worker secrets. Keep keys, Prices and webhook secrets in the same mode.
- Set `APP_BASE_URL`; Checkout and portal return URLs must use that exact origin.
- Register `/stripe/webhook` for Checkout completion, subscription update/deletion, invoice paid/payment failed, and trial-will-end events. Confirm the exact event names in the handler before configuring the dashboard.
- Apply local migrations before local plan edits. Remote plan changes require authority and must target the correct D1 database; account-specific Stripe IDs do not belong in migrations.

For local testing, forward Stripe CLI events to the running local API's `/stripe/webhook`, using the listener's signing secret. Do not send local test traffic to the public API. Keep the listener active to test cancellation and invoice state, even when subscription status reconciliation recovers a delayed Checkout webhook.

## Enable overage

Create a Billing Meter and a recurring metered Price on the subscription product. Set `stripe_meter_id` to the meter's **event name**, and `overage_price_id` to the metered Price ID, through the admin plan-credit operation. Keep these unset until the external objects exist.

Overage is opt-in. `/stripe/overage` requires an entitled subscription and payment method and adds/removes the metered subscription item. Hourly `stripe_usage_sync` sends whole-credit deltas with stable identifiers; fractional remainder stays pending. A plan without a meter event name is skipped, so check that first when an invoice is short. A downgrade to Free disables overage.

## Staff access and revocation

Use the normal Pro subscription with a customer-restricted, single-redemption promotion code backed by a 100%-off ongoing discount. Have the person start Checkout first to create their Stripe Customer, then restrict the code to that exact Customer. Avoid shared unrestricted staff codes.

Cancel the subscription to revoke entitlement. Archiving a promotion code only prevents later redemption; it does not remove an existing discount. To retain paid Pro while ending the discount, change the subscription deliberately and verify the next invoice.

## Diagnose

| Symptom                               | Check                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------- |
| Price not configured                  | Plan row in the D1 database used by the running API                       |
| Price not found                       | Stripe account and test/live mode                                         |
| Return URL rejected                   | Web origin matches `APP_BASE_URL`                                         |
| Checkout succeeds without entitlement | Signed webhook delivery, Customer mapping and subscription reconciliation |
| Cancelled subscription still entitled | Subscription/invoice webhook status and stored plan                       |
| Overage absent from invoice           | Opt-in, payment method, meter event name, metered Price and sync state    |

Verify activation, renewal, cancellation and failed-payment paths against the actual handler's entitlement policy. Do not create a second staff or manual entitlement path to bypass it.
