# ADR 0091: Run hosted Hermes in the agent worker

Status: Implemented in `apps/agent-worker`; needs a deployed canary before release.

## Context

The computer worker owns persistent Chromium sessions, while the sandbox worker runs repository tasks. Hermes owns persistent agent sessions, so combining its container, network policy, checkpoints and model proxy with either worker couples separate lifecycles.

## Decision

Run one Hermes container per paid member in a dedicated agent worker. Map each Polychat conversation to a Hermes session and checkpoint `HERMES_HOME` to R2. Keep the member's API key in Durable Object storage and add it only to the Worker-side model request. The container has no internet access; the Worker allows package registries, R2 and the Polychat model route.

The API declines Hermes approval requests until Polychat has an approval surface. Cancelled and timed-out runs are stopped. The first message after a host sleeps starts the container as part of the run; model selection does not make a Hermes-specific wake request.

## Consequences

The agent worker is a separate deployable. Hermes cannot browse the public web, and the first turn after fifteen minutes of inactivity pays the startup cost. A deployed canary must verify model requests, checkpoint restore, registry access and blocked egress before release.
