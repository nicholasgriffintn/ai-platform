# Credits replace message limits everywhere, anonymous visitors included

- **Change:** The daily message-count guard is gone from every surface. `AUTH_DAILY_MESSAGE_LIMIT` and `NON_AUTH_DAILY_MESSAGE_LIMIT` are deleted, along with the `daily_message_count`, `daily_reset`, `daily_pro_*`, and `*_byok_message_count` columns on `user` and the daily counters on `anonymous_user`. Signed-out visitors now hold a credit allowance of their own, admitted and settled through the same credit path as signed-in accounts: the allowance comes from `DEFAULT_PLAN_INCLUDED_CREDITS.anonymous` (15 credits), and spend lives on `anonymous_user.credit_period` / `spent_credit_micros` / `reserved_credit_micros` rather than in the per-event ledger. `GET /plans` now resolves the built-in allowance when a plan row leaves `included_credits` null, so pricing and billing never render a zero.
- **Surfaces:** API, Web, iOS
- **Prerequisites:** migrations `0017_organic_blue_blade` and `0018_pretty_lockjaw` applied. No plan configuration is required.
- **Risk if wrong:** an anonymous visitor is either locked out immediately or never limited at all, since their allowance is keyed on a hashed IP and shared by everyone behind it. A monthly 15-credit allowance per IP is materially different from the old ten messages a day, and shared or corporate egress IPs feel it first.

## Verify

- [ ] Signed out, send a message and confirm the `usage_limits` stream event carries a `credits` object with `included: 15` and no `daily` field.
- [ ] Keep sending as the same anonymous visitor and confirm `anonymous_user.spent_credit_micros` grows, that `credit_period` is the current `YYYY-MM`, and that turns are refused once included plus reserve is spent.
- [ ] Set `credit_period` on that row to last month, send one message, and confirm the balance restarts from that turn rather than continuing.
- [ ] Call `POST /audio/speech` with no credentials and no `provider` while the anonymous allowance lasts, then again once it is spent: the first succeeds, the second is refused as a usage limit.
- [ ] Sign in as a free account with `plans.included_credits` still null and confirm the sidebar popover shows a credits meter with a non-zero allowance, not an empty section.
- [ ] Sign in as Pro and confirm the sidebar, Profile > Billing, and `/pricing` all agree on the allowance.
- [ ] Confirm no surface anywhere still says "messages a day": sidebar, composer banners, Profile > Account, Profile > Billing, `/pricing`.
- [ ] Confirm a signed-in turn still writes `usage_event` rows, and that an anonymous turn writes none while still moving the anonymous balance.

**Stop and report if:** anonymous visitors behind a shared IP are refused on their first message, or if an anonymous session is never refused however much it spends. Both mean the actor resolution or the period rollover is wrong.

## Notes

Anonymous spend is deliberately a running total rather than a ledger: `usage_event.user_id` is a non-null foreign key to `user`, and widening it for visitors who can never see a ledger would weaken the signed-in path for nothing. The admission algorithm, credit state machine, reserve, and runaway ceiling are shared by both actor kinds; only the storage differs.

The anonymous allowance is the one number here chosen rather than derived. Fifteen credits a month per hashed IP is a guess at "enough to try Polychat, not enough to farm it", and it is the first thing to revisit if signed-out conversion drops or abuse rises.
