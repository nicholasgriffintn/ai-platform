# Background tasks, workbench runs, approvals and unread state update live across devices

- **Change:** the API now publishes `task.changed`, `workbench_run.changed`, `workbench_preview.changed`, `connector_approval.changed`, `conversation.unread_changed` and `attention.changed` over the per-user socket, and the web app stops polling those queries while the socket is open. Conversation detail polling also defers to the socket. Every mutation request carries an `X-Device-Id` header so the device that made a change does not receive its own echo; run events are exempt so the originating tab still sees run progress. Replicate and research results publish too but keep polling as a safety net.
- **Surfaces:** API, web app, desktop app.
- **Prerequisites:** the API's CORS allow-list now includes `X-Device-Id`; deploy the API before the web app.
- **Risk if wrong:** a second device stops seeing background task, workbench run, inbox or unread changes until it reloads, or the originating device misses an update it used to get from polling.
- **Commits:** 206815fb6, 553059dad, 5ddb36d4c.

## Verify

- [ ] Open the same account in two browsers. Start a sandbox run from Work on one; the run list and status on the other update within a couple of seconds with no page reload.
- [ ] On one browser mark an inbox item read on the Attention page; the unread count on the other drops immediately.
- [ ] Pin or mark a conversation unread on one browser; the sidebar on the other reflects it without a reload.
- [ ] Send a message on one browser and confirm that browser still shows the streamed reply and final title, then confirm the other browser shows the new conversation.
- [ ] With the socket blocked (devtools offline for WebSocket only), confirm the Work task board still refreshes on its own within thirty seconds.

**Stop and report if:** a second device stays stale for more than a few seconds while its socket shows as connected, or the originating device misses its own run completion.
