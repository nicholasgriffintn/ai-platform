# Privacy-safe turn continuity telemetry

- **Change:** Existing backend monitoring now measures stored-turn connection state, bounded detachment reasons and durations, authorised cancellation requests, and authorised web and iOS recovery attempts without recording conversation content or identity metadata.
- **Surfaces:** API monitoring, web recovery and cancellation, and iOS recovery.
- **Prerequisites:** Deploy the API, web application and iOS application from compatible releases; use the existing monitoring destination.
- **Risk if wrong:** Continuity decisions could be based on incomplete cohorts, high-cardinality data, or events that misclassify normal completion, detachment, cancellation or recovery.
- **Commits:** Not yet committed.
- **Deployment:** API Worker `assistant` version `1bc474b5-e223-424a-9d1c-f0bd02caad8c` was deployed on 5 September 2026. Web and iOS were not deployed in this work.

## Verify

- [ ] Complete attached and detached stored turns from web and iOS; confirm `turn_continuity_finished` records only allowlisted platform, connection state, detachment reason, outcome, cancellation observation and bounded duration fields.
- [ ] Exercise reader closure and a failed stream write; confirm the terminal metric distinguishes `reader_closed` from `write_failed` and never includes prompt, response, tool, provider, model, user or workspace data.
- [ ] Stop a web response after authorisation; confirm `turn_continuity_cancellation_requested` is emitted only after the cancellation write succeeds and the terminal turn records cancellation observation when it sees the request.
- [ ] Interrupt a stored turn on web and iOS, then recover it; confirm recovery attempts report `pending` before persistence, `success` only after a newer assistant message is visible, and `timeout` only on the final unsuccessful attempt.
- [ ] Make the monitoring destination unavailable; confirm generation, cancellation and recovery behaviour still completes through the existing paths.
- [ ] Before reopening the durability decision, confirm the cohort satisfies every threshold in [the measurement plan](../../turn-continuity-measurement.md), including 28 days, 1,000 detached terminal turns and per-surface minimums.

**Stop and report if:** monitoring changes user-visible turn behaviour, records non-allowlisted metadata, emits before the existing authority checks, or the production cohort does not meet the evidence gate.
