# Mobile Work notifications and run control

- **Change:** iOS receives generic project-work alerts and opens compact Activity, Proof and existing run controls.
- **Surfaces:** iOS, API and APNs delivery.
- **Prerequisites:** apply migration `0026_wild_rawhide_kid.sql`; configure `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` and `APNS_TOPIC`; enable Push Notifications for the signed iOS application identifier.
- **Risk if wrong:** alerts may not arrive, may open stale work or may offer an action the API no longer permits.

## Verify

- [ ] Register sandbox and production builds, then confirm APNs delivery reaches only the matching environment and repeated event delivery produces one alert per device.
- [ ] Trigger input, approval, review, completion and failure; confirm locked alerts contain no project names, task copy, commands, paths, logs, errors or credentials.
- [ ] Open each alert and confirm it reaches the exact conversation, task or run, then reloads current Activity and Proof.
- [ ] Answer a task's structured questions, approve and reject pending task and run requests, accept a reviewed task, add a run instruction, continue and cancel; confirm expired interactions and stale controls reload instead of overwriting current state.
- [ ] Finish a run before opening its alert and confirm controls are absent and terminal Proof is shown.
- [ ] Revoke project membership before opening and before sending another alert; confirm the resource is inaccessible and no later project alert is sent.
- [ ] Invalidate an APNs token and confirm later delivery skips it without logging the token.

**Stop and report if:** a locked alert exposes work detail, a revoked member can open the resource or a stale action mutates the run.
