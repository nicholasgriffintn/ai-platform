# ADR 0008: Bound model retries and surface unknown writes

Status: Implemented.

## Problem

Direct providers and Cloudflare AI Gateway could each retry the same model request, multiplying attempts without a run-wide account or visible client state. A transport failure after submitting an external write also cannot prove whether the provider applied it, so blindly repeating the tool can duplicate an effect.

## Decision

Own model retries at the shared model-turn transport boundary. Each provider and gateway request makes one network attempt. An eligible model call may make one additional attempt, and a run may spend at most two such retry slots across all of its model steps. Respect a valid `Retry-After` up to 30 seconds, otherwise use capped exponential delay with jitter. Poll cancellation during the wait and start no further provider call after cancellation.

Retry only rate limiting, network failure, timeout, HTTP 408 or 425, and provider 5xx responses. Invalid input, credentials, authorisation, policy, usage limits and conflicts remain terminal with their existing actionable errors. A failure after response streaming has begun is terminal, because replaying it could duplicate visible output or tool calls.

Persist the current retry snapshot on the exact running attempt and append an ordered `run.retry_changed` event. The snapshot distinguishes waiting from attempting and the model-call attempt from the run-wide retry number, and carries a static safe reason rather than provider details. Clear it on success, exhaustion, cancellation or any terminal transition.

Classify connector write failures at the external-operation boundary. A definitive rate-limit rejection is `not_applied` and may be repeated once with identical parameters. A transport failure after invocation has `unknown` outcome: an explicitly idempotent operation may repeat once with identical parameters, while a non-idempotent operation is blocked and requires the user to check the external system. Do not expose raw provider bodies, credentials or operation arguments in the outcome.

## Consequences

A small run-wide retry budget favours predictable latency and spend over maximum recovery from a prolonged outage. Cancellation is cooperative and cannot retract an already submitted request. `unknown` is intentionally conservative: reconciling the provider may require a person even when the write ultimately failed. Never convert that uncertainty into silent success or automatic non-idempotent replay.
