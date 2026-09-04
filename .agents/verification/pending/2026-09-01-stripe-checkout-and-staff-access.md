# Stripe Checkout reports missing configuration and supports staff promotion codes

- **Change:** Checkout now rejects a missing plan Price before writing to Stripe, accepts Stripe promotion
  codes, and recovers an active or trialling subscription when its completion webhook is delayed.
  Operators can issue customer-restricted, 100%-off forever codes for staff through the normal Pro
  subscription path.
- **Surfaces:** web, API
- **Prerequisites:** configure the Stripe secrets and webhook, store the matching recurring Pro Price ID in
  `plans.stripe_price_id`, and create a customer-restricted staff promotion code as described in the Stripe
  billing runbook.
- **Risk if wrong:** paid checkout remains unavailable, an unrestricted discount leaks permanent free Pro,
  or a completed staff subscription does not activate Pro.
- **Commits:** pending

## Verify

- [ ] Clear the local Pro Price ID, choose **Upgrade to Pro** under **Profile > Billing**, and confirm the API
      reports a service configuration error without creating a new Stripe Customer.
- [x] Submit Checkout with a success or cancellation URL on another origin and confirm the API rejects it
      before creating a new Stripe Customer. _(Local release E2E uses a lookalike foreign origin; the isolated Stripe boundary receives no customer request.)_
- [ ] Restore the test Pro Price ID, choose **Upgrade to Pro**, and confirm Stripe Checkout opens with the
      promotion-code control and the expected recurring £8/month Pro product.
- [ ] Complete local Checkout without forwarding the completion webhook, reload **Profile > Billing**, and
      confirm Polychat finds the Stripe subscription, stores its ID, and replaces **Upgrade to Pro** with
      the active subscription controls.
- [ ] Redeem a 100%-off forever code restricted to that Customer and confirm the signed webhook changes the
      Polychat account to Pro without the code being accepted for a different Customer.
- [ ] Cancel the staff subscription in Stripe and confirm the webhook returns the account to Free.

**Stop and report if:** Checkout sends a blank Price to Stripe, a customer-restricted code works for another
Customer, or subscription cancellation leaves the account on Pro.
