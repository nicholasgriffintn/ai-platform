# Credit balance, ledger, and pricing surfaces

- **Change:** Profile > Billing becomes the money page when a plan has credits configured: balance meter with a reserve segment, spend breakdown by source and vendor, a paginated ledger, and a subscription card with billing portal and overage controls. A public `/pricing` page renders plan cards from `GET /plans`. The sidebar usage popover gains a credits meter and the composer gains reserve and exhausted banners. All of it falls back to the previous daily-limits presentation while `included_credits` is unset.
- **Surfaces:** Web
- **Prerequisites:** the usage ledger PR deployed, and a plan given `included_credits`/`grace_credits` values for the configured checks. The `POST /stripe/portal` and `POST /stripe/overage` routes ship separately.
- **Risk if wrong:** money copy that misleads, or a fallback that hides billing entirely for accounts still on daily limits.

## Verify

- [ ] With no plan credits configured, Profile > Billing looks exactly as before this change: subscription status or the upgrade offer, no credit meter, no ledger. The sidebar popover shows the standard/pro/byok bars and `/pricing` describes daily limits on each plan card.
- [ ] Configure `included_credits` on your plan, spend something, and confirm Billing shows the balance meter with the reserve boundary marked, the breakdown matching `GET /user/usage/summary`, and the ledger paginating with "Show more" until `next_cursor` is null.
- [ ] Send a message on your own provider key and find its ledger rows: cost shown, zero credits, marked as your key.
- [ ] Before the portal/overage routes are deployed, click "Manage billing" and toggle overage once each: the control should quietly disappear rather than error. After those routes deploy, the portal opens Stripe and the toggle persists through a balance refetch.
- [ ] Push a balance into `reserve`: the sidebar meter grows an amber trailing segment, and the composer shows a dismissible heads-up that stays gone for the session and returns after a reload.
- [ ] Push the balance to `exhausted` without overage: the composer banner turns critical, is not dismissible, and links to Billing.
- [ ] Visit `/pricing` signed out (sign-in prompt on the CTA) and signed in (checkout redirect, current plan disabled).

**Stop and report if:** the unconfigured fallback fails to render the old billing view, since that is every account until plans are configured.
