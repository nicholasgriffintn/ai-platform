# Profile > Tasks no longer lists credit accounting plumbing

- **Change:** Credit metering enqueues a `usage_rollup` task for every batch of usage events, and infrastructure metering emits a batch per request. Those tasks carry the person's user id, so Profile > Tasks filled up with rows reading `usage_rollup - COMPLETED` for anyone who merely browsed the app. `listUserTasks` now hides the accounting task types — `usage_rollup`, `realtime_reconciliation`, `infra_reconciliation` and `stripe_usage_sync` — from the account list. The rows are still written and still carry their user id, so operators can trace them in the database.
- **Surfaces:** API, Web
- **Prerequisites:** none.
- **Risk if wrong:** low and one-directional. Too broad a filter would hide a task a person is waiting on — memory synthesis is the one they can trigger themselves and must still appear. Too narrow and the list is noise again.

## Verify

- [x] Sign in, browse a few Profile tabs and send a chat message, then open Profile > Tasks. Expect no `usage_rollup` rows. _(Local release E2E exercises both browsing and a metered chat turn.)_
- [x] On a brand new account that has only browsed, expect Profile > Tasks to show the empty state rather than a list. _(Local release E2E for both Free and Pro personas.)_
- [ ] Trigger a memory synthesis from Profile > Tasks and confirm it appears in the list and reaches a completed status — the filter must not hide the one task a person starts by hand.
- [ ] Confirm `usage_rollup` rows are still being written: check the `tasks` table for recent rows of that type carrying a user id.

**Stop and report if:** memory synthesis stops appearing in the list, or the `tasks` table shows no `usage_rollup` rows after a chat turn — the second would mean metering stopped rather than the list being filtered.
