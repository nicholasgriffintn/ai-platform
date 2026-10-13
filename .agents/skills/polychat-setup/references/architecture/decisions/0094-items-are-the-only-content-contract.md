# ADR 0094: Items are the only content contract

Status: Implemented for conversations, responses and the event stream.

## Problem

Content crossed the wire in four shapes: stored messages with `content` and `parts`, eleven input content part types on completion requests, OpenAI `tool_calls` arrays on assistant messages, and five event payload shapes that each described a message differently. Conversations were called "completions" on the wire and read through `/chat/completions/:id/messages`. Every client re-derived a message model from each shape.

## Decision

An Item is the only content contract. A stored conversation is a list of items, a Response produces items, and the event stream adds and completes items.

- Stored item types are `message` (roles `user`, `assistant`, `system`, `developer`), `tool_output`, `compaction` and `goal`. The stream adds `tool_call`. Input adds `interaction_response` and `approval_response`, which answer a waiting response.
- An item carries `content` as content parts, optional structured `parts`, an `id`, a `status` and a `metadata` bag for the fields a message already recorded (model, provider, usage, citations, log id, provenance, run id and so on). `messagesToItems` and `itemsToMessages` are inverse functions, tested as such, so the stored message table does not change and nothing a surface rendered is lost.
- Routes name the resource: `/conversations`, `/conversations/:id`, `/conversations/:id/items`, `/conversations/items/:item_id`, `/conversations/:id/branches`, `/conversations/:id/title`, `/conversations/shared/:share_id`, with queue, goal, delegations, organisation and artifact bindings under the conversation they belong to.

## Consequences

The server projects once, in `conversations/application/present.ts`, and the client hydrates once, in `normaliseConversationItems`. Partial content from an in-progress response appears as an item like any other. Items stay a close relative of the stored message on purpose: a lossless projection first, and a richer union once the sandbox and desktop producers emit items directly.
