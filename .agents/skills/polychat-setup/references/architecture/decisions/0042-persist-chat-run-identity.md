# ADR 0042: Persist chat run identity and command acknowledgement

Status: Accepted.

Conversations, messages, model calls and tool calls do not identify one accepted unit of work. Persist a run around the existing turn engine so clients and queued project work can refer to the same operation without inferring lifecycle from transcript shape.

## Decision

Assign every authenticated, stored chat execution a server-generated `run_<id>` identifier. A run records its conversation, optional project and project-task scope, initiating user, attempt, status, timestamps, terminal reason and last produced message. Messages and project tasks may reference the run. Anonymous, local-only and explicitly non-stored turns remain outside this contract.

Use protocol version 1 and these states:

- `accepted` becomes `running`, or terminates as `failed`, `cancelled` or `interrupted`.
- `running` may wait as `awaiting_input` or `awaiting_approval`, enter `cancelling`, or terminate as `succeeded`, `failed`, `cancelled` or `interrupted`.
- Either waiting state may resume as a new `running` attempt, enter `cancelling`, or terminate.
- `cancelling` terminates as `cancelled`, `failed` or `interrupted`.
- Terminal states are immutable. Every transition compares the current attempt and state so stale completion cannot replace newer authority.

Clients may attach a `command_id` to a turn or interaction response and a `run_id` when resuming. The receipt contains protocol version, command ID, command kind, acceptance time, duplicate flag and the authoritative run. A command identity is unique per user. Repeating the same canonical input returns the original run; using it with a different conversation, kind, input digest or requested run returns HTTP 409. Old clients may omit both fields; the server generates a command identity, preserving behaviour without giving those clients cross-request idempotency.

Return the latest run additively as `latest_run` on conversation detail, emit receipts as `state: run` during streaming, include the receipt on buffered responses, and expose `GET /chat/runs/:run_id`. The exact-run response includes the complete stored message set associated with that run. A client that loses the stream resolves the run from its turn command when necessary, then observes this snapshot until a waiting or terminal state instead of treating any new assistant message as completion. Personal status requires the initiating user. Project status requires current workspace membership, regardless of who initiated it.

Cancel with `POST /chat/runs/:run_id/cancel`, a new command identity and the attempt the client observed. The server rejects a stale attempt, makes repeated compatible cancellation commands idempotent, and returns `cancelling` while a live owner is still working. Accepted or waiting runs without a live execution step can become `cancelled` immediately. A running owner checks authoritative cancellation between model/tool safe points and owns the final transition to `cancelled`; cancelling does not claim that an in-flight provider or external tool call was interrupted.

Keep execution in the existing agent loop and use the owner-scoped conversation lease at commit boundaries. Losing that lease records `interrupted`; ordinary execution errors record `failed`. This contract identifies and acknowledges work. ADR 0024 grants durable ownership only to queue-dispatched stored project tasks; interactive and local-only traffic retain their existing continuity limits.

## Trade-off

The initial run row can exist before a new conversation's first persisted message, so `conversation_id` is indexed but not a foreign key. Project and user scope remain foreign-keyed, and message/project-task references are nullable for compatibility and retention. Run status is a compact authoritative snapshot rather than an ordered event log. Project-task recovery reconciles safe snapshots but does not replay an in-memory stack. Clients poll active runs every two seconds and owners normally observe cancellation within one second at the next safe check; provider and external-tool latency can extend actual interruption. Ordered replay, retention gaps and closing the snapshot/subscription race remain G07 responsibilities.
