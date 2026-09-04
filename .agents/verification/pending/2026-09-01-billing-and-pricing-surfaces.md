# Credit balance, ledger, and pricing surfaces

- **Change:** Profile > Billing becomes the money page when a plan has credits configured: balance meter with a reserve segment, spend breakdown by source and vendor, a paginated ledger, and a subscription card with billing portal and overage controls. A public `/pricing` page renders plan cards from `GET /plans`. The sidebar usage popover gains a credits meter and the composer gains reserve and exhausted banners. Credits are now the only presentation: plans always resolve an allowance, so there is no daily-limits fallback left.
- **Surfaces:** Web
- **Prerequisites:** the usage ledger PR deployed. Plan rows need no credit values: `GET /plans` resolves the built-in allowance when `included_credits` is null.
- **Risk if wrong:** money copy that misleads, or a billing page that shows nothing because the balance failed to resolve.

## Verify

- [x] With `plans.included_credits` still null, confirm `/pricing` shows a non-zero monthly credit figure and a reserve line on each plan card, and that Profile > Billing shows a balance rather than an empty state. _(Local release E2Es deliberately exercise null plan columns and the 15/150/1,500 built-in allowances.)_
- [x] Spend something and confirm Billing shows the balance meter with the reserve boundary marked, the breakdown matching `GET /user/usage/summary`, and the ledger paginating with "Show more" until `next_cursor` is null. _(Local release E2E seeds 27 rows, validates the 25-row page boundary and terminal cursor, and matches the UI to the exact summary response it rendered; metered API reads may add later infrastructure rows.)_
- [x] Send a message on your own provider key and find its ledger rows: cost shown, zero credits, marked as your key. _(Local release E2E validates the event contract and the `your key` ledger presentation.)_
- [ ] With Stripe unconfigured, click "Manage billing" and toggle overage once each: both controls should quietly disappear rather than error. With Stripe configured, the portal opens and the toggle persists through a balance refetch.
- [ ] Push a balance into `reserve`: the sidebar meter grows an amber trailing segment, and the composer shows a dismissible heads-up that stays gone for the session and returns after a reload.
- [ ] Push the balance to `exhausted` without overage: the composer banner turns critical, is not dismissible, and links to Billing.
- [ ] Visit `/pricing` signed out (sign-in prompt on the CTA) and signed in (checkout redirect, current plan disabled).

**Stop and report if:** any account sees a zero or missing credit allowance, since plans are expected to resolve a built-in allowance without configuration.
