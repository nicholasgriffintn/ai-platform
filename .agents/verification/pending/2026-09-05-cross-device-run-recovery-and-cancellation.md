# Cross-device run recovery and cancellation

- **Change:** web and iOS now recover and stop the exact accepted run through authoritative attempt-fenced snapshots.
- **Surfaces:** API, web Chat, Work conversations and native iOS.
- **Prerequisites:** apply generated D1 migrations `0021_late_grandmaster.sql` and `0022_eager_cargill.sql`; deploy compatible API before either client.
- **Risk if wrong:** a client may mistake an intermediate message for completion, stop a successor attempt, lose partial output or claim cancellation before the owner stops.
- **Commits:** none yet.

## Verify

- [ ] Start a multi-step stored task on web, disconnect after an intermediate tool or assistant message, then reopen the conversation. Confirm return-time recovery keeps showing the same run before reconciling its complete final message set.
- [ ] Repeat with the connection lost before the run receipt arrives. Confirm the live request fails without polling, then reopen the conversation and confirm its active run is recovered without starting another task.
- [ ] While web remains attached to a running task, open the conversation on iPhone and stop it. Confirm both clients first show the stop request and later show `cancelled` with the same run ID and attempt while retaining partial messages.
- [ ] Start on iPhone and stop from web. Confirm the same cross-device transition and no conversation-wide fallback stop request.
- [ ] Pause a run for a question and for approval. Confirm both clients distinguish each waiting state from running, cancelling, failed, interrupted, cancelled and completed outcomes.
- [x] Resume a waiting run, then submit a delayed cancellation for its previous attempt. Confirm HTTP 409 and verify the successor attempt continues.
- [x] Repeat a cancellation with the same command identity and payload. Confirm the same receipt is returned and no additional cancellation action occurs; reuse the command with changed input and confirm HTTP 409.
- [x] Revoke project membership before exact-run status and cancellation requests. Confirm both return not found and reveal no run or message data.
- [ ] Run an external tool that takes longer than the owner’s cancellation poll. Confirm the UI remains at `cancelling` until the call settles, then becomes `cancelled` without replaying the effect.
- [ ] Confirm anonymous, explicitly non-stored and local-only conversations keep their existing device-local stop behaviour and create no recoverable server run.

**Expected interval:** a client observing a detached active run refreshes at most every two seconds; the originating live client uses SSE and issues no replay reads. A live owner checks authoritative cancellation at roughly one-second intervals between safe model/tool boundaries; an already-running provider or external tool call may extend final interruption.

**Stop and report if:** an intermediate message ends recovery, a cancellation affects another run or attempt, either client drops authoritative partial messages, a non-member can read or cancel a project run, or the UI labels an accepted request as fully cancelled before owner confirmation.

## Automated evidence — 5 September 2026

The local Chromium **cancels one run idempotently and stops detached recovery** journey passed with real run endpoints. Reusing the exact command returns the original receipt with `duplicate: true`; changing its expected attempt returns 409. Reload shows Task cancelled, removes Stop requested and stops active recovery. Cross-device iPhone steps remain unconfirmed.

## Automated browser/API evidence — 8 September 2026

- The corresponding project-access, skill-tools and teammate-feedback journeys passed in `test-results/container/d20cf00c/results.json`. The tests use separate authenticated sessions, real persistence and current server authority; project restoration additionally checks the audit actor, output and revision identifiers.

## Automated evidence — 9 September 2026

- The passing cancel service test sets current attempt 2 and submits expected attempt 1: HTTP 409 is returned before acceptCancellation is invoked. Repository tests also fence delayed cancellation after an attempt change. This validates the exact server boundary; it does not assert a physical two-device gesture.
