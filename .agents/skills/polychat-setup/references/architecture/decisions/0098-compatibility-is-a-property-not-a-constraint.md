# ADR 0098: Compatibility is a property, not a constraint

Status: Implemented in `apps/api/src/modules/ports/chat-completions`.

## Problem

Polychat opened with `POST /chat/completions` matching OpenAI, and the platform grew inside that shape: Polychat fields were added to the OpenAI body until the body carried ninety of them, and the raw OpenAI Responses passthroughs (`use_responses`, `input_items`, `include_defaults`) leaked a vendor's API into Polychat's own. Agent harnesses that only speak the OpenAI dialect had their own route at `/agents/model/chat/completions`.

## Decision

This is the Polychat platform API. Where a Polychat surface overlaps a vendor shape, Polychat's is a compatible superset: the vendor body is accepted as written, and Polychat adds parameters, capabilities and actions on the same endpoint. No surface is designed down to a vendor's feature set, and no surface is a strict match.

- `POST /chat/completions` is a port onto `/responses`. An unmodified OpenAI client works. A client that knows Polychat may add `conversation`, `agent`, `environment`, `model_tier`, `permission_mode`, `compaction`, `budget`, `idempotency_key`, `response_id` and the Polychat tool union on the same body.
- A stateless request, with no conversation, agent, environment or `store: true`, runs the model directly and bills the caller. That is what an OpenAI client and an agent harness expect, and it is the path the hosted harnesses from [ADR 0092](0092-host-agent-harnesses-on-polychat-ports.md) now use at the platform base URL.
- A stateful request runs as a Response and is rendered back in chat completion shape with the Response attached under `response`; the final stream chunk carries it the same way.
- Every extension maps to a field on `POST /responses`, so the port never grows behaviour of its own. Passthrough fields with no platform equivalent are gone.

## Consequences

External API-key users keep OpenAI compatibility and gain the platform's parameters without leaving the endpoint they know. The agent worker's model port is the public port. The same rule applies to `/responses`, `/models` and anything else that happens to overlap a vendor shape.
