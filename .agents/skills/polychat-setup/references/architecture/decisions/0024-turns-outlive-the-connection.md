# ADR 0024: Run one turn engine and separate it from transport

Status: Accepted.

Separate turn execution from its connection so streaming and buffered calls obey the same budgets, persistence and goal rules.

## Decision

Run chat turns through `executeAgentLoop` and the API's `runAgentLoop`. A transport resolves one buffered or streamed model response; common finalisation stores messages and tool results. Resolve step budgets in one policy module, apply the goal finish gate to both transports, and capture memories once after the run.

Keep SSE and hand the streaming run to `executionCtx.waitUntil`. Treat a disconnected reader as detachment: stop writing to it, continue finalisation, and release resources from the run's own `finally`. Send heartbeat comments while connected. The submitting web or iOS client consumes that live turn through SSE only; a transport failure ends that client stream rather than silently replacing it with polling.

Expose the current coordinator operation through authorised conversation reads. Read operation status before history so an idle result includes completed writes. When a client later opens a conversation with a detached active run, restore activity from an authorised run snapshot and poll its ordered events until it reaches a waiting or terminal state.

Make Stop explicit through `/chat/completions/:id/cancel` before aborting the fetch. The detached turn watches a timestamped KV cancellation flag. Background execution is not a separate product mode.

Persist the accepted operation and its command acknowledgement through the shared run contract in [ADR 0056](0056-persist-chat-run-identity.md). That identity makes lifecycle authoritative but does not upgrade `waitUntil` into durable execution ownership for interactive Chat.

Treat queue-dispatched, stored project-task turns as the supported durable cohort. The existing Cloudflare task queue owns those executions independently of the HTTP request that enqueued them. Persist an opaque execution owner and five-minute lease on the queue task, renew it every minute, and fence both generic task settlement and project-task state changes through that owner. A redelivery waits while the live lease remains valid and may recover only after expiry.

Recover a project-task run from persisted state, not an in-memory agent stack. Reconcile a persisted `succeeded`, `awaiting_input` or `awaiting_approval` run without repeating model or tool execution. Classify `accepted`, `running` or `cancelling` work left by a failed owner as `interrupted`; require an explicit later retry rather than replaying possible external writes. Persisted interactions remain recoverable for seven days, after which recovery resolves the card as expired and fails the run honestly.

Use the run ID for a durable chat credit reservation. Normal finalisation releases it; owner recovery and final failure release any orphan and return persisted connector sessions to the existing cleanup path. Queue ownership governs settlement, while current workspace membership and task policy still govern execution.

Use `ConversationCoordinator` as a lease-bounded, non-reentrant lock. Every acquisition has an opaque owner token and a five-minute expiry. A live owner renews every minute; failed renewal fences that attempt. Renewal, ownership checks and release compare the token, so an expired owner cannot modify a successor's lease. Crash recovery is expiry followed by a new acquisition, not re-entry by the old token.

Every history-mutating entry point acquires the lock, including message replacement, compaction, interaction answers and async results. Acquire at route/service or queue entry points, never inside an already locked turn. Validate and refresh ownership immediately before local conversation persistence, giving each accepted commit boundary a fresh lease. Interactive callers receive a retryable conflict; queued or opportunistic work skips as appropriate. Missing, invalid or unreachable coordination fails closed for mutations. Release a turn's lock when the run ends, before signalling completion, using only its own token.

## Trade-off

Recovery reads the saved result rather than replaying live events. `waitUntil` remains best-effort continuation for personal stored Chat, and local-only/non-stored Chat remains device-private with no server recovery. Queue-owned project tasks survive request disconnects, but Cloudflare delivery limits still bound one attempt and a mid-step Worker loss is interruption rather than continuation.

Local persistence is owner-fenced, but a remote tool side effect already dispatched cannot be rolled back or atomically coupled to that check. G06 cancellation must address the exact run and queue owner. G11 must supply idempotency or reconciliation before interrupted external writes can be retried automatically. G17 owns sweeps for orphan leases, reservations and cleanup records beyond the per-delivery settlement implemented here.
