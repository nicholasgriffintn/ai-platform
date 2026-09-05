# Ordered chat run replay

- **Change:** stored chat runs now expose bounded ordered events with authoritative snapshot reset on gaps.
- **Surfaces:** API, stored personal Chat, Work conversations, web and native iOS.
- **Prerequisites:** apply generated D1 migrations `0021_late_grandmaster.sql`, `0022_eager_cargill.sql` and `0023_glossy_stephen_strange.sql`; deploy the API before replay-capable clients.
- **Risk if wrong:** missed or repeated delivery may duplicate activity, hide accepted work, regress terminal state or expose project activity after membership revocation.
- **Commits:** none yet.

## Verify

- [ ] Start a stored multi-step task and inspect its snapshot. Confirm the cursor is non-negative and replay from that cursor returns only later events in strictly increasing sequence order with stable IDs.
- [ ] Disconnect between snapshot acquisition and the next event write. Reconnect and confirm the write appears either in the snapshot or replay, allowing a harmless duplicate but never disappearing from both.
- [ ] Deliver the same replay page twice and deliver one page in reverse order to both web and iPhone. Confirm no duplicate message/activity appears and the final cursor and run state match.
- [ ] Deliver an older running event after a terminal event. Confirm neither client reopens the task.
- [ ] Produce more than 500 events, then request a cursor before the retained window. Confirm the API returns `resetRequired: true`, no event page and a snapshot whose cursor becomes the new baseline.
- [ ] Simulate an internal sequence hole and a cursor ahead of the server. Confirm each produces the same explicit snapshot reset rather than silently advancing.
- [ ] Add an unknown event type under protocol version 1. Confirm current clients refresh the snapshot, keep rendering, and do not invent visible activity.
- [ ] Return a protocol version newer than the client supports. Confirm iPhone and web enter snapshot-only recovery rather than crashing, discarding the conversation or interpreting the event.
- [ ] Revoke project membership while a client is polling. Confirm the next snapshot and replay requests return not found and expose no event or message data.
- [ ] Confirm local-only, anonymous and explicitly non-stored turns create no run events and perform no replay requests.

**Expected bounds:** the server retains the newest 500 events for each run, returns at most 100 per replay page and active clients poll every two seconds. Large message and output content remains in authorised stored resources referenced by events.

**Stop and report if:** a cursor gap is hidden, a repeated event duplicates visible state, terminal state regresses, the snapshot/replay boundary loses a write, a newer protocol breaks native conversation rendering, or revoked membership can still read activity.
