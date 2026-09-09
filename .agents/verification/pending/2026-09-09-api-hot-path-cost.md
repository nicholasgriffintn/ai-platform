# API requests stop fanning out into per-request usage tasks

- **Change:** Per-request infrastructure usage now writes its ledger event inline after the response instead of creating a task row and queue delivery for every authenticated request. Repository construction is lazy and the Drizzle client is shared per D1 binding. Loading a conversation fetches its metadata once and reads status, latest run and thread family in parallel. Settled immediate tasks older than seven days are purged in the fifteen-minute maintenance sweep, and the 4 AM infrastructure reconciliation cron is now registered. Credit balance and goal changes are published on the per-user socket, so the balance popover and goal panel no longer poll while connected. The web app no longer refetches the model catalogue on every mount or focus, resolves the session before the bearer token arrives, and treats a still-loading session as pending rather than signed out.
- **Surfaces:** API, web.
- **Prerequisites:** none.
- **Risk if wrong:** infrastructure usage events stop appearing in the ledger, conversation loads return stale `active_operation` or `latest_run`, the balance or goal panels go stale while a socket is open, or the composer stays disabled after sign-in.
- **Commits:** pending.

## Verify

- [ ] Sign in, open a conversation, then request `GET /user/usage/events` and confirm new `infrastructure` events with `d1_rows_read` still arrive for that request window.
- [ ] Inspect the `tasks` table for the same window and confirm no new `usage_rollup` rows are created by ordinary GET requests, and that rows older than seven days with status `completed` or `cancelled` disappear after the next quarter-hour sweep.
- [ ] Watch D1 write volume and p50 API latency in the Cloudflare dashboard for an hour after deploy; both should drop compared with the previous day.
- [ ] Open a conversation with a running turn and confirm the header still shows the active operation and the latest run usage.
- [ ] Load `/chat` on a signed-in Pro account and confirm the thread never shows "Temporary. Nothing here is kept." while the page is loading.
- [ ] With the sync socket open, send a message and confirm the credit balance in the sidebar popover updates without a `GET /user/usage/balance` poll in the network tab; set a goal and confirm the goal panel updates without polling `/goal`.
- [ ] Confirm the 4 AM cron now appears in the Worker's triggers after deploy.

**Stop and report if:** infrastructure events vanish from the usage ledger, a conversation page shows no active operation while a turn is clearly streaming, or the balance or goal panel stays stale for more than a minute with the socket open.
