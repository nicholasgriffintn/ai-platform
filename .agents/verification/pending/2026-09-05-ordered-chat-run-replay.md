# Ordered chat run replay

- **Change:** stored chat runs now expose bounded ordered events with authoritative snapshot reset on gaps.
- **Surfaces:** API, stored personal Chat, Work conversations, web and native iOS.
- **Prerequisites:** apply generated D1 migrations `0021_late_grandmaster.sql`, `0022_eager_cargill.sql` and `0023_glossy_stephen_strange.sql`; deploy the API before replay-capable clients.
- **Risk if wrong:** missed or repeated delivery may duplicate activity, hide accepted work, regress terminal state or expose project activity after membership revocation.
- **Commits:** none yet.

## Verify

- [ ] Start a stored multi-step task and inspect its snapshot. Confirm the cursor is non-negative and replay from that cursor returns only later events in strictly increasing sequence order with stable IDs.
- [ ] Disconnect between snapshot acquisition and the next event write. Reconnect and confirm the write appears either in the snapshot or replay, allowing a harmless duplicate but never disappearing from both.
- [x] Deliver the same replay page twice and deliver one page in reverse order to both web and iPhone. Confirm no duplicate message/activity appears and the final cursor and run state match.
- [ ] Deliver an older running event after a terminal event. Confirm neither client reopens the task.
- [ ] Produce more than 500 events, then request a cursor before the retained window. Confirm the API returns `resetRequired: true`, no event page and a snapshot whose cursor becomes the new baseline.
- [x] Simulate an internal sequence hole and a cursor ahead of the server. Confirm each produces the same explicit snapshot reset rather than silently advancing.
- [x] Add an unknown event type under protocol version 1. Confirm current clients refresh the snapshot, keep rendering, and do not invent visible activity.
- [x] Return a protocol version newer than the client supports. Confirm iPhone and web enter snapshot-only recovery rather than crashing, discarding the conversation or interpreting the event.
- [x] Revoke project membership while a client is polling. Confirm the next snapshot and replay requests return not found and expose no event or message data.
- [ ] Confirm local-only, anonymous and explicitly non-stored turns create no run events and perform no replay requests.

**Expected bounds:** the server retains the newest 500 events for each run, returns at most 100 per replay page and clients observing detached active runs poll every two seconds. The originating live client uses SSE and makes no replay requests. Large message and output content remains in authorised stored resources referenced by events.

**Stop and report if:** a cursor gap is hidden, a repeated event duplicates visible state, terminal state regresses, the snapshot/replay boundary loses a write, a newer protocol breaks native conversation rendering, or revoked membership can still read activity.

## Automated evidence — 5 September 2026

The local Chromium `features/run-replay.spec.ts` journey passed: snapshot cursor validation, strictly increasing later sequences, stable unique event IDs, identical repeated replay pages, and snapshot reset for a cursor ahead of the server. This uses a delayed streamed provider reply and real stored run endpoints. Leave the combined multi-step, retention-window, protocol-injection and cross-client steps open.

## Automated service evidence — 8 September 2026

- The replay service test supplies an internal sequence hole and receives resetRequired with an empty event page and the authoritative snapshot cursor. The existing passing run-replay E2E recorded in local evidence covers a cursor ahead of the server. Retention generation and cross-client protocol injection remain open.
- The batched API run passed 66 tests across nine files in 2.61 seconds. Evidence is from service-level failure injection with repository and outbound effects substituted, not a live external integration.

## Automated browser/API evidence — 8 September 2026

- The corresponding project-access, skill-tools and teammate-feedback journeys passed in `test-results/container/d20cf00c/results.json`. The tests use separate authenticated sessions, real persistence and current server authority; project restoration additionally checks the audit actor, output and revision identifiers.

## Further automated evidence — 8 September 2026

- The six shared-client replay tests pass and `pnpm test:mobile` passes 111 tests plus its UI journey. Reviewed cases cover duplicate/out-of-order events, terminal regression, unknown event kinds and newer protocols. The new native controller regression proves that a newer protocol causes exactly one replay request followed only by snapshots until completion. Event injection uses client-boundary fixtures; no physical-device claim is made.
