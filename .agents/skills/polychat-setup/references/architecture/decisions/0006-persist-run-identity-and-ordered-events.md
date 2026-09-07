# ADR 0006: Persist run identity and an ordered event journal

Status: Implemented.

## Problem

Conversations, messages, model calls and tool calls do not identify one accepted unit of work, so clients inferred lifecycle from transcript shape. Reading current state also cannot distinguish duplicate delivery or prove that no update was missed.

## Decision

Assign every authenticated, stored chat execution a server-generated `run_<id>`. A run records its conversation, optional project and project-task scope, initiating user, attempt, status, timestamps, terminal reason and last produced message. Anonymous, local-only and explicitly non-stored turns remain outside this contract.

Use protocol version 1 and these states: `accepted` becomes `running` or terminates; `running` may wait as `awaiting_input` or `awaiting_approval`, enter `cancelling`, or terminate as `succeeded`, `failed`, `cancelled` or `interrupted`; either waiting state may resume as a new `running` attempt; `cancelling` terminates. Terminal states are immutable, and every transition compares the current attempt and state so stale completion cannot replace newer authority.

Clients may attach a `command_id` to a turn or interaction response and a `run_id` when resuming. Repeating the same canonical input returns the original run; reusing that command identity with a different conversation, kind, input digest or requested run returns HTTP 409. Old clients may omit both fields, preserving behaviour without gaining cross-request idempotency.

Assign each stored run event a stable ID, protocol version, run ID, attempt, monotonically increasing per-run sequence, type, occurrence time and small data object. Persist `run.accepted`, `run.status_changed`, `message.created`, `message.updated` and `run.retry_changed`; message events reference the stored message ID and never duplicate large bodies. Write the event in the same D1 batch as its lifecycle transition or message write, and retain the latest 500 events per run.

Expose an authorised snapshot resource returning the cursor read before materialisation plus the authoritative run and its complete stored message set, and an authorised events resource returning a contiguous ordered page. A cursor older than retention, ahead of the run, or separated by any detected hole returns `resetRequired`, no events and an authoritative snapshot. Reading the cursor before run state closes the snapshot race: a concurrent write may appear in both the snapshot and later replay, but cannot appear in neither.

Clients sort a page, ignore applied sequences, require contiguity, and prevent an event from regressing a terminal run or older attempt. Unknown additive events cause a snapshot refresh; a newer envelope or event protocol falls back to snapshots, so independently released clients keep showing authoritative state. Use two-second authenticated polling only as return-time catch-up for a detached active run, never alongside the originating SSE stream or as an in-place fallback when it fails. Each request rechecks the initiating user for personal runs or current project membership for project runs.

Cancel by naming the run and the attempt the client observed. The server rejects a stale attempt, makes repeated compatible cancellation commands idempotent, and returns `cancelling` while a live owner is still working. A running owner checks cancellation between model and tool safe points and owns the final transition; cancelling does not claim that an in-flight provider or external call was interrupted.

## Consequences

The initial run row can exist before a new conversation's first persisted message, so `conversation_id` is indexed but not a foreign key. Run status is a compact authoritative snapshot rather than a log, and events are a synchronisation journal with deliberately bounded retention. Return-time polling adds up to two seconds of latency and repeated authorised reads, but reuses the current HTTP surface without competing with live SSE. A failed live stream stays visible to that client until the conversation is reopened.
