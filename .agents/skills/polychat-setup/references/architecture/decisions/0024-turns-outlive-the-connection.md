# ADR 0024: Run one turn engine and separate it from transport

Status: Accepted.

Separate turn execution from its connection so streaming and buffered calls obey the same budgets, persistence and goal rules.

## Decision

Run chat turns through `executeAgentLoop` and the API's `runAgentLoop`. A transport resolves one buffered or streamed model response; common finalisation stores messages and tool results. Resolve step budgets in one policy module, apply the goal finish gate to both transports, and capture memories once after the run.

Keep SSE and hand the streaming run to `executionCtx.waitUntil`. Treat a disconnected reader as detachment: stop writing to it, continue finalisation, and release resources from the run's own `finally`. Send heartbeat comments while connected. Web and iOS recover transport failures by polling for the persisted answer; a definitive API error is not a recoverable disconnect.

Expose the current coordinator operation through authorised conversation reads. Read operation status before history so an idle result includes completed writes. Restore web activity and poll after a full refresh; bound recovery of a local, not-yet-stored turn to three minutes.

Make Stop explicit through `/chat/completions/:id/cancel` before aborting the fetch. The detached turn watches a timestamped KV cancellation flag. Background execution is not a separate product mode.

Use `ConversationCoordinator` as a lease-bounded, non-reentrant lock. Every history-mutating entry point acquires it, including message replacement, compaction, interaction answers and async results. Acquire at route/service or queue entry points, never inside an already locked turn. Interactive callers receive a retryable conflict; queued or opportunistic work retries or skips as appropriate. Release a turn's lock when the run ends, before signalling completion.

## Trade-off

Recovery reads the saved result rather than replaying live events. `waitUntil` is best-effort continuation within Worker execution limits, not crash recovery or a durable job queue. KV cancellation is eventually consistent. The coordinator lease can expire; omitting its binding disables locking, while a configured but unreachable coordinator refuses acquisition. Keep these limits visible when changing long-running work.
