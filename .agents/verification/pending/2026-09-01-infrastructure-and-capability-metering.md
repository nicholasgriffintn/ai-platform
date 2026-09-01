# Capability calls, containers, Durable Objects and realtime sessions are now metered

- **Change:** Everything outside the chat turn is now priced into the ledger. Capability calls are metered where the provider registry hands out a provider; D1 rows, Durable Object calls, Vectorize dimensions, and queue operations accumulate per request and land as one `infrastructure` event batch; sandbox runs report container-seconds from the worker and settle a reservation taken at dispatch; realtime sessions take a reservation at mint, carry a duration cap, and settle through a scheduled `realtime_reconciliation` task. A nightly `infra_reconciliation` task compares what we attributed against Cloudflare's own account totals.
- **Surfaces:** API, sandbox worker
- **Prerequisites:** deploy the API and the sandbox worker together — the worker calls a route that only exists after the API deploy. Optionally set `CLOUDFLARE_ANALYTICS_API_TOKEN` (an account-scoped token with Account Analytics: Read) to enable nightly reconciliation; without it the task no-ops. `SANDBOX_INSTANCE_TYPE` and `REALTIME_MAX_SESSION_SECONDS` both have working defaults.
- **Risk if wrong:** mostly silent, because this phase still enforces nothing. The exceptions are the realtime admission check, which can refuse a session, and the sandbox usage route, which is new and authenticated. A reservation that is held but never settled inflates `reserved_credit_micros` for that period and would push a later phase toward refusing work the user has actually paid for.

## Verify

- [ ] Deploy the API, then the sandbox worker. Confirm `POST /apps/sandbox/runs/:runId/usage` exists and rejects an unauthenticated call.
- [ ] Start a sandbox run and let it finish normally. Expect `container_vcpu_seconds`, `container_gib_seconds`, and `container_disk_gb_seconds` rows in `GET /user/usage/events`, with quantities in the ratio 0.25 : 1 : 4 for the `basic` instance type, and a `usage_reservation` row for that run in status `settled`.
- [ ] Cancel a sandbox run mid-flight. Expect container-second rows for the shorter duration and the reservation still settled — a cancelled run must not leave a held reservation behind.
- [ ] Confirm a run's reservation is released rather than settled when the worker cannot be reached at all: check `usage_reservation` for that run id shows `released`, not `held`.
- [ ] Send a chat message and confirm exactly one batch of `infrastructure` rows for that request, including `d1_rows_read` and `do_requests`. Two `do_requests` per turn is expected; substantially more means something is calling a coordinator inside a loop.
- [ ] Generate an image and run an OCR extraction. Expect a `capability` event with unit `images` for the first, and one with unit `pages` whose quantity matches the page count for the second.
- [ ] Store your own provider key for a capability provider, run that capability again, and confirm the new event carries `byok: true` **and** is still `billable: true` with a non-zero `credit_micros`. Capability and infrastructure spend is charged whether or not the key was yours — this is the opposite of the model-token rule.
- [ ] Open a realtime session. Confirm the response carries `max_session_seconds` (1800 by default), that a `usage_reservation` of kind `realtime` appears for the session id, and that the session closes on its own at the cap.
- [ ] Wait past the cap plus two minutes and confirm the reservation moved to `settled` with a matching usage event. Then confirm re-running that reconciliation task does not produce a second event or a second balance movement.
- [ ] With plans unconfigured (`plans.included_credits` null), confirm a realtime session is still admitted regardless of recorded spend. Credit enforcement is not this phase's job and a refusal here would be a regression.
- [ ] Without `CLOUDFLARE_ANALYTICS_API_TOKEN` set, trigger the nightly task and confirm it logs a skip and writes nothing, rather than erroring.
- [ ] With the token set, trigger it and confirm `infra_cost_daily` rows appear for the previous UTC day, each carrying both a `cost_micros` from Cloudflare's totals and an `attributed_cost_micros` from our own events.

**Stop and report if:** any sandbox run finishes with its reservation still `held`, a realtime session is refused while plans are unconfigured, or `infra_cost_daily` shows attributed cost exceeding Cloudflare's reported cost for the same resource by more than a rounding margin. The first two are bugs in this change; the third means attribution is double counting and a later phase would overcharge.

## Notes

Workers AI neurons are intentionally not attributed per request — the `AI` binding returns no cost, so they appear only in the nightly account-level reconciliation. An empty `ai_neurons` row in `usage_event` is correct, not a gap.

Automated coverage exists for reservation settle and release idempotency, container-second arithmetic from the instance table, the realtime admission rule, and the no-token no-op. The boxes above are the parts only a human running the real thing can confirm.
