# ADR 0095: One event envelope on every channel

Status: Implemented for the response stream, lifecycle replay and the per-user socket; harness, desktop session and sandbox producers still project at the API edge.

## Problem

Seven vocabularies said "something is producing output": the chat server-sent events (`message_start`, `content_block_delta`, `thinking_delta`, `tool_use_*`, `tool_response*`, `state`, `turn_activity`), the stored run events (`run.*`), the sync socket (`run.changed`, `run.event`), agent harness events, desktop agent session events, sandbox run events and machine run updates. The web client parsed the chat vocabulary in an 865-line assembler and iOS carried a second parser. None of the events were sequenced, so a reconnecting client could not say where it had got to.

## Decision

Every event is an envelope with `type`, `sequence_number`, `response_id` and `conversation_id`, and the same envelope travels on the creating request's stream, on `GET /responses/:id/events`, and as the payload of `response.changed` and `response.event` on the per-user socket from [ADR 0041](0041-carry-live-updates-on-one-per-user-socket.md).

- Response lifecycle: `response.created`, `response.in_progress`, `response.waiting`, `response.completed`, `response.failed`, `response.cancelled`, `response.incomplete`, `response.status_changed`, `response.retry`, `response.phase`, `response.activity`, `response.usage`, `response.usage_limits`, `response.error`.
- Items: `response.output_item.added`, `response.output_item.done`, `response.content_part.done`, `response.output_text.delta`, `response.reasoning.delta`, `response.reasoning.signature`, `response.tool_call.arguments.delta`, `response.tool_outputs.done`.
- Conversation: `conversation.compacted`, `conversation.title_changed`.
- The stored lifecycle log keeps its retention and cursor semantics and renames its types to `response.created`, `response.status_changed`, `response.retry_changed` and `response.effect`. Replay reports response statuses, never internal run statuses.

The engine's agent loop still emits its internal event names into a sink. `createResponseEventProjector` in `packages/schemas` turns them into envelopes at the server-sent event writer, assigning sequence numbers and item identity, so preludes such as a compaction marker or a replayed connector approval are written through the same writer and keep the sequence continuous. The client's `createResponseStreamAssembler` consumes envelopes and produces the updates the existing hooks already understood.

## Consequences

One parser on the client, one serialiser on the server, and a sequence number on every event. The projector is the seam where the harness, desktop session and sandbox producers will be moved onto envelopes directly; until then they continue to reach the stream through the chat sink and are projected like everything else.
