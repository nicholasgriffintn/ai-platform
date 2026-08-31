# Usage enforcement, plan ranking and billing state

- **Change:** Daily usage counters are now incremented with relative SQL instead of read-modify-write, pro entitlement is decided by plan rank rather than string equality, anonymous text-to-speech is limited and gated, Stripe subscription status now drives entitlement, and the Analytics Engine dataset changed shape.
- **Surfaces:** API. No web or iOS change; the web app reads `usage_limits` through the unchanged payload.
- **Prerequisites:** `2026-08-31-00-deploy-prerequisites.md`. No migration is needed for this item.
- **Risk if wrong:** paid access is granted or revoked incorrectly, or a daily limit stops holding under load.

## Verify

- [ ] Sign in as a free account and send messages until the daily limit refuses the next one. Confirm the refusal is the usage-limit message, not a 500.
- [ ] Send several chat requests in parallel from one free account near the limit and confirm the stored `daily_message_count` moved by the number of messages actually stored, not by one.
- [ ] Confirm the counter restarts on the next UTC day rather than continuing from yesterday's total.
- [ ] Set an account's `plan_id` to `enterprise` and confirm it can reach a `requirePlan("pro")` route, for example the drawing or articles apps, and can select a pro model.
- [ ] Confirm a free account still cannot select a pro model and receives the upgrade message.
- [ ] Call `POST /audio/speech` with no credentials and no `provider`. It should succeed while the anonymous allowance lasts, then be refused once spent.
- [ ] Call `POST /audio/speech` with no credentials and `provider: "elevenlabs"`. It must be refused as unauthenticated.
- [ ] Confirm `POST /audio/transcribe` still requires an account.
- [ ] In Stripe test mode, move a Pro subscription to `past_due`. Confirm the account drops to free and receives one payment-failed email.
- [ ] Redeliver that same webhook from the Stripe dashboard. Confirm no second email and no further write.
- [ ] Return the subscription to `active`. Confirm pro access is restored without a new subscription email.
- [ ] Confirm an `enterprise` account is not downgraded when its Stripe subscription lapses.
- [ ] Open `GET /metrics` and confirm rows return with the new `provider`, `model`, `latencyMs` and token columns populated for recent traffic.
- [ ] Confirm `GET /metrics?type=<value>` still filters, and that a value containing a quote is rejected with a 400 rather than reaching Analytics Engine.
- [ ] After the next artificial-analysis ingest task runs, check the Worker logs for the model price drift summary and read any divergence it reports.

**Stop and report if:** a paying account loses pro access without a matching Stripe status, or the parallel-message check shows a counter moving by less than the number of messages stored.

## Notes

Analytics Engine blob and double positions were appended to, not reordered, so historical rows still read
correctly for the columns they carry. The index moved from `traceId` to the metric name, which changes how
the dataset samples; rows written before this change keep their old index.

Price drift is reported only. Nothing rewrites the model catalogue, which stays authoritative.
