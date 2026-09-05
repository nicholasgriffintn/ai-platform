# Run usage and settlement

- **Change:** Stored runs now group recorded usage across exact attempts, separate reservation estimates from consumed credits, and recover expired holds.
- **Surfaces:** API, web Chat and Work task detail, iPhone Chat and task inbox, scheduled API maintenance.
- **Prerequisites:** Apply migration `0030_many_lizard.sql`; keep the existing task queue and Analytics Engine bindings configured; allow at least one scheduled invocation to exercise expiry recovery.
- **Risk if wrong:** A runner may see misleading usage, a retry may lose attribution, or a held estimate may remain against the account balance.
- **Commits:** Uncommitted worktree change.

## Verify

- [ ] Start a stored run that retries once, then open **Context** on web and iPhone. Confirm both attempts share one run, the current context estimate is labelled, and recorded credits are not duplicated.
- [ ] Inspect the same Work task stage. Confirm its exact attempt shows the same consumption and settlement state as the run.
- [ ] Use a provider response without usage telemetry. Confirm recorded consumption says **unknown**, never zero, while any context token estimate remains labelled estimated.
- [ ] Cancel an active run and retry the cancel command. Confirm the run stops once, its hold is released once, and the duplicate-command and cancellation-latency signals contain identifiers and classifications without prompt or tool arguments.
- [ ] In a safe test environment, age a held chat-run reservation past 24 hours and run scheduled maintenance. Confirm it becomes released and the account reserved balance falls once even if maintenance repeats.
- [ ] Force durable-owner recovery and an uncertain connector write in a non-production provider account. Confirm recovery/ownership and unknown-outcome signals are distinguishable and the UI does not claim the external write failed or succeeded.

**Stop and report if:** consumed credits appear twice, unknown usage appears as zero, a retry is attributed to another run, a duplicate settlement changes the balance again, or observability includes message content, arguments or credentials.
