# ADR 0005: Run one turn engine and separate it from transport

Status: Implemented.

## Problem

Streaming and buffered calls must obey the same budgets, persistence and goal rules, and a turn must not end because its connection did.

## Decision

Run chat turns through `executeAgentLoop` and the API's `runAgentLoop`. A transport resolves one buffered or streamed model response; common finalisation stores messages and tool results. Resolve step budgets in one policy module, apply the goal finish gate to both transports, and capture memories once after the run.

Hand the streaming run to `executionCtx.waitUntil`. Treat a disconnected reader as detachment: stop writing to it, continue finalisation, and release resources from the run's own `finally`. Send heartbeat comments while connected. The submitting client consumes that live turn through SSE only; a transport failure ends that client's stream rather than silently replacing it with polling.

Make Stop explicit through the cancel route before aborting the fetch. The detached turn watches a timestamped KV cancellation flag. Background execution is not a separate product mode.

Treat queue-dispatched, stored project-task turns as the supported durable cohort. The Cloudflare task queue owns those executions independently of the HTTP request that enqueued them. Persist an opaque execution owner and five-minute lease on the queue task, renew it every minute, and fence both generic task settlement and project-task state changes through that owner. A redelivery waits while the live lease remains valid and may recover only after expiry.

Recover a project-task run from persisted state, not an in-memory agent stack. Reconcile a persisted `succeeded`, `awaiting_input` or `awaiting_approval` run without repeating model or tool execution. Classify `accepted`, `running` or `cancelling` work left by a failed owner as `interrupted` and require an explicit later retry rather than replaying possible external writes. Persisted interactions remain recoverable for seven days, after which recovery resolves the card as expired and fails the run honestly.

Use `ConversationCoordinator` as a lease-bounded, non-reentrant lock. Every acquisition has an opaque owner token and a five-minute expiry; a live owner renews every minute, and failed renewal fences that attempt. Renewal, ownership checks and release compare the token, so an expired owner cannot modify a successor's lease. Crash recovery is expiry followed by a new acquisition, never re-entry by the old token.

Every history-mutating entry point acquires that lock — message replacement, compaction, interaction answers and async results — at route, service or queue entry, never inside an already locked turn. Interactive callers receive a retryable conflict; queued or opportunistic work skips. Missing, invalid or unreachable coordination fails closed for mutations.

## Consequences

Recovery reads the saved result rather than replaying live events. `waitUntil` remains best-effort continuation for personal stored Chat, and local-only Chat remains device-private with no server recovery. Queue-owned project tasks survive request disconnects, but Cloudflare delivery limits still bound one attempt and a mid-step Worker loss is interruption rather than continuation. Local persistence is owner-fenced, but a remote tool side effect already dispatched cannot be rolled back or atomically coupled to that check.
