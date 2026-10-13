# ADR 0093: One Response object for every run

Status: Implemented in the API `responses` module, `packages/schemas/src/platform` and the web and desktop clients.

## Problem

`POST /chat/completions` was the door for Chat, project conversations, Poly, teammates, delegations, channels, recipes, the project task runner and queued follow-ups. Nine server-side callers built the same public request body, and that body carried ninety fields on one object: OpenAI sampling, raw OpenAI Responses passthroughs, Polychat run control, tool policy, and trusted authority such as `trigger`, `delegation_context` and `durable_execution` that no client may set. The reply was one of three shapes, an OpenAI completion with `parts` smuggled onto a choice, a run command receipt, or a server-sent event stream, and every client branched on which one arrived. Teammates had a second door at `POST /teammates/:id/completions` with the identical body.

## Decision

A Response is the unit of execution and the only shape a run is reported in. `POST /responses` creates one; `GET /responses/:id` returns it with its output items; `GET /responses/:id/events` replays its lifecycle; `POST /responses/:id/input` continues it; `POST /responses/:id/cancel` stops it; `GET /responses?idempotency_key=` finds the one an accepted key produced.

- The Response carries the run state machine with platform names (`queued`, `in_progress`, `awaiting_input`, `awaiting_approval`, `awaiting_takeover`, `cancelling`, `completed`, `failed`, `cancelled`, `incomplete`), plus `attempt`, `trigger`, `provenance`, `retry`, `usage`, an optional `receipt` for the idempotency key that accepted it, and `output` items. The stored run record keeps its internal statuses; `toResponse` maps at the boundary.
- A run with no stored conversation is still a Response, synthesised from the completion so every caller reads one shape.
- The actor is a field, not a route. `agent: { type: "teammate", id }` selects a teammate or Poly; the teammate completion route is gone.
- The public request names only what a client may choose: conversation, input items, instructions, model, agent, environment, tools, permission mode, sampling, text, budget, stream, store and an idempotency key. Trigger, delegation context, durable execution and resolved configuration are set by the server when it starts a response on someone's behalf and never appear on the wire.
- The engine keeps its internal command (`responseCommandSchema` in the schemas package) because nine internal callers already speak it. `toResponseCommand` maps the public request onto it in one place.

## Consequences

Chat, Work, teammates, Poly and the OpenAI-compatible port read the same object and the same status names. The client holds one `latest_response` per conversation and one cancel path. Replacing the engine's command with a typed `ResponseCommand` plus `ResponseAuthority` for the internal callers is the next step; the public wire is already clean of trusted fields. iOS decodes the same Response and items and streams from `/responses`.
