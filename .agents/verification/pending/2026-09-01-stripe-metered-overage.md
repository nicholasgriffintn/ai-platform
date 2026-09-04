# Overage credits bill through Stripe meters, with a portal and an opt-in

- **Change:** Opted-in overage spend now reaches Stripe. An hourly `stripe_usage_sync` task sends one Billing Meter event per customer per hour for whole credits of unsynced overage, tracked by a new `usage_balance.stripe_synced_overage_credit_micros` high-water mark. `POST /stripe/overage` enables or disables overage (adding or removing the plan's metered subscription item), `POST /stripe/portal` opens the Stripe billing portal, `PUT /admin/plans/:id/credits` sets a plan's credit and metering columns, `GET /plans` now exposes `included_credits`, `grace_credits` and `overage_available`, and a webhook plan change writes the plan's entitlement into the current period's balance. Checkout and portal redirect URLs are now validated against `APP_BASE_URL`.
- **Surfaces:** API
- **Prerequisites:** apply migration `0016_ordinary_obadiah_stane`; set `APP_BASE_URL` in the API environment; in Stripe test mode create a Billing Meter (note its event name) and a metered recurring price on the subscription product; set `stripe_meter_id` (the meter event name), `overage_price_id`, `included_credits` and `grace_credits` on the pro plan via `PUT /admin/plans/pro/credits`.
- **Risk if wrong:** money. Undersync means overage is consumed but never billed; oversync or a broken high-water mark double-charges a customer; a broken redirect validation with an unset `APP_BASE_URL` blocks every checkout.

## Verify

- [ ] Apply `0016_ordinary_obadiah_stane` and confirm `usage_balance` gained only `stripe_synced_overage_credit_micros`, defaulting to 0.
- [ ] `GET /plans` shows the credit columns you set, and `overage_available: true` only for the plan with an `overage_price_id`.
- [ ] With a test-mode subscription and saved card, `POST /stripe/overage {"enabled": true}` succeeds, the subscription in the Stripe dashboard gains the metered item, and repeating the call adds nothing. `{"enabled": false}` removes the item again.
- [ ] `POST /stripe/overage {"enabled": true}` on an account without a payment method is refused with a clear message, not a Stripe error.
- [x] `POST /stripe/portal` with a `return_url` on the app origin returns a working portal URL; a foreign origin (including `https://<app-host>.evil.example`) is rejected with a 400. _(Local release E2E validates both paths against the isolated Stripe boundary.)_
- [ ] Seed overage: set `overage_enabled` and a few million `overage_credit_micros` on the current period's balance row for the test user, wait for (or run) the top-of-hour sync, and confirm exactly one meter event arrives in Stripe test mode with the whole-credit value and identifier `<customerId>:<hourIso>`.
- [ ] Confirm `stripe_synced_overage_credit_micros` advanced by exactly the whole credits sent times 1,000,000, leaving any sub-credit remainder pending.
- [ ] Run the sync twice for the same hour and confirm Stripe still shows one event and the mark did not advance twice.
- [ ] Cancel the test subscription and confirm the webhook downgrade switches `overage_enabled` off for the current period.

**Stop and report if:** a second meter event appears for the same customer and hour, or the high-water mark advances without a matching Stripe event. Either direction is a billing defect, not a cosmetic one.

## Notes

The sync only sends whole credits; balances below one pending credit are skipped until they accumulate. Plans without `stripe_meter_id` are skipped silently (debug log), so a missing meter configuration looks like "no events" rather than an error.
