# Conversations and live surfaces update across devices without a refresh

- **Change:** a per-user `UserSyncCoordinator` Durable Object now carries live updates to every signed-in device over one WebSocket. Chat run and conversation changes publish to it, and client query caches refresh from those events instead of from timers. Polling remains as a fallback whenever the socket is not open.
- **Surfaces:** API (`/sync/grant`, `/sync/ws`), web, desktop. iOS is unchanged and still polls.
- **Prerequisites:** add the `USER_SYNC_COORDINATOR` Durable Object binding and the `v5-user-sync` migration to `apps/api/wrangler.json` before deploying, following `wrangler.jsonc.example`. `JWT_SECRET` must be set; grants are refused without it.
- **Risk if wrong:** devices show stale conversations, or a socket subscribes to a conversation the viewer may not read.
- **Commits:** branch `feat/live-device-sync`.

## Verify

- [ ] Sign in on two devices. Send a message on one; confirm the conversation appears and reorders in the other's sidebar within a second or two, with no refresh.
- [ ] Open the same conversation on both devices. Confirm the reply lands on the follower as it completes, and that the follower shows the run as active while it runs.
- [ ] Archive a conversation on one device; confirm it leaves the other's sidebar.
- [ ] Rename a conversation on one device; confirm the new title appears on the other.
- [ ] Block WebSockets (or stop the API) and confirm the app still updates on its original polling intervals, then restore the connection and confirm live updates resume without a reload.
- [ ] With a Work project conversation open, remove a member from the workspace, have them reconnect, and confirm they no longer receive that conversation's events.
- [ ] Check `infra_cost_daily` for `do_requests` after a busy session and confirm the volume is in line with expectations.

**Stop and report if:** a device receives events for a conversation its viewer cannot open, or the sidebar stops updating with the socket connected.
