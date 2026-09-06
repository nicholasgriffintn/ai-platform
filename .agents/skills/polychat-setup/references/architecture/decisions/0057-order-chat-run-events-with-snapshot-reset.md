# ADR 0057: Order chat run events with snapshot reset

Status: Accepted.

Exact-run polling restores current state but cannot distinguish duplicate delivery, prove that no update was missed, or efficiently drive later activity interfaces. Extend the persisted chat run with a bounded ordered event stream and an authoritative reset contract rather than treating transport delivery as state.

## Decision

Assign each stored run event a stable ID, protocol version, run ID, attempt, monotonically increasing per-run sequence, type, occurrence time and small data object. Persist `run.accepted`, `run.status_changed`, `message.created` and `message.updated` events. Lifecycle events carry compact status fields; message events reference the stored message ID and never duplicate large message or output bodies. Later features may add event types without changing this envelope.

Increment `conversation_run.event_sequence` and write the corresponding event in the same D1 batch as the lifecycle transition or message write. Retain the latest 500 events per run. Existing migrated runs begin at cursor zero with no synthetic history; their authoritative snapshot establishes the baseline before new events are consumed.

Expose two authorised resources:

- `GET /chat/runs/:run_id/snapshot` returns protocol version 1, the cursor read before snapshot materialisation, the authoritative run and its complete stored message set.
- `GET /chat/runs/:run_id/events?after=<cursor>&limit=<1..100>` returns the contiguous ordered page, its next cursor and no snapshot. A cursor older than retention, ahead of the run, or separated by any detected hole returns `resetRequired: true`, no events and an authoritative snapshot.

Reading the snapshot cursor before reading run state and messages closes the snapshot/subscription race: a concurrent write may appear in both the snapshot and later replay, but cannot appear in neither. Clients sort a page, ignore already-applied sequences, require the next sequence to be contiguous, and prevent an event from regressing a terminal run or older attempt. Message-reference and unknown additive events cause a snapshot refresh. A newer envelope or event protocol causes snapshot-only fallback, so independently released iOS clients continue showing authoritative state without guessing at unfamiliar events.

Use two-second authenticated polling only as return-time catch-up for a detached active run. Never start it alongside the originating SSE stream or use it as an in-place fallback when that stream fails. Each request rechecks the initiating user for personal runs or current project membership for project runs, so access revocation applies without maintaining a long-lived unauthorised subscription. Web and iOS stop full-conversation polling once this replay loop owns catch-up synchronisation.

## Trade-off

Return-time polling adds up to two seconds of observation latency and performs repeated authorised reads, but reuses the current HTTP deployment surface without competing with live SSE. A failed live stream is visible to that client until the conversation is reopened or another client observes the detached run. The sandbox coordinator’s 500-entry buffer is not reused: it silently truncates, does not represent a reset, and can miss a broadcast between listing and socket attachment. Run events are a synchronisation journal, not the source of truth; snapshots remain authoritative and event retention is deliberately bounded.
