# ADR 0024: Turns outlive the connection

## Status

Accepted

## Context

A chat turn ran inside the request that started it. `createChatTurnStream` built an SSE writer, drove `runAgentLoop` into it, and returned the readable half as the response body. Nothing kept the turn alive once the client went away.

So a client going away lost the turn. Close the tab, sleep the laptop, lose signal, background the iOS app, and the readable half was cancelled, the writer errored on its next event, the run unwound through its catch, and the assistant message was never persisted. The work was already paid for at the provider. The user came back to a conversation ending in their own question.

Long silences were exposed too. The stream sent nothing between provider events, so a turn that spent a minute inside a tool call held an idle connection and depended on every intermediary tolerating it. The sandbox path had already learned this and emits `: ping`; chat never did.

We had one product answer to this, and it was borrowed. Background mode set `background: true` on OpenAI Responses, which returned a placeholder message and left the frontend polling an async invocation. It only worked on one provider, forced `use_responses`, restricted the model picker to text-only, and was surfaced as a top-level mode in the composer next to Chat and Live — a provider capability wearing the costume of a product decision. It answered "what if this needs to keep running" for one vendor's models and nobody else's.

The obvious fix is a durable event log per turn, in a Durable Object, replayed by index on reconnect. That is what `SandboxRunCoordinator` does for coding runs, and it is the right shape for a run measured in minutes with a client that expects to re-attach mid-stream. It also puts a Durable Object in the path of every chat turn, billed by wall-clock for the length of the turn, on the free tier as much as anywhere else. Chat turns are frequent, short, and mostly do not need mid-stream re-attachment — they need to finish and be saved.

## Decision

Keep SSE. Keep the turn in the Worker. Make it survive the client.

`createChatTurnStream` and `createModelEnsembleStream` hand their run to `executionCtx.waitUntil`, so the turn completes and persists whether or not anyone is still reading. The SSE writer treats a cancelled readable as detachment rather than failure: writes become no-ops, and the run continues to its normal end through `finaliseAssistantTurn` and the conversation manager. The connector run is closed by the run's own `finally` instead of by stream cancellation, because cancellation no longer means the turn is over.

Both streams emit `: ping` every fifteen seconds. SSE comments are ignored by the shared parser in `packages/schemas/src/chat-stream.ts` and by the iOS parser, so no client changed.

Clients re-attach by reading the result, not by resuming the stream. `recoverDetachedTurn` polls `GET /chat/completions/:id` after a stream fails for any reason other than a deliberate abort, and resolves when an assistant message that was not there before appears. The user sees "Reconnecting to the response…" and then the answer.

The web client keys active response state, cancellation, progress, and pending human action by conversation ID. Navigating to another conversation therefore leaves the original turn running without leaking its loading state into the new view. Chat and Work conversation lists show a spinner for those active turns and retain an action marker when a tool stops for input or approval.

Stopping stays real, and is now explicit. Detaching no longer stops the turn, so a stop that only aborted the fetch would leave the model running and bill the user for an answer they cancelled. The composer's stop posts to `/chat/completions/:id/cancel` before aborting, which writes a timestamped flag to KV under a two-minute TTL. A turn reads that flag **only after it notices the client has detached**, and honours it only if it was written after the turn began. The read is one a second for the first thirty seconds a turn is detached and one every five seconds after that, for as long as the turn runs, so a turn abandoned early stays cancellable rather than only briefly. A turn nobody abandons never reads it, and nothing is written or cleared on the happy path, so an ordinary turn costs no KV operations at all.

Delete background mode. Every turn is now resumable work that continues outside the active stream, which is what the mode's own description promised, so the selector, its model gate, its suggestion, and its conversation-mode metadata go. `background` survives as a request option on `/chat/completions` because it is a real OpenAI Responses parameter and API callers may want it; it is no longer a thing the product offers as a mode.

## Trade-offs

A client that reconnects waits for the whole turn rather than joining it mid-flight. There is no event log, so there is nothing to replay from — recovery shows a spinner until the answer lands, where a Durable Object would have streamed the tail. For turns measured in seconds this is a fair trade for keeping a Durable Object out of every chat request; for anything longer it is the thing to revisit first, and `ConversationCoordinator` is where it would live. The coordinator itself is a lock and nothing more; [ADR 0039](0039-conversation-coordinator-is-a-lock.md) settles its scope.

Cancellation is best-effort and eventually consistent. KV read-after-write is fast within a colo and the cancel request almost always lands in the same one as the turn, but it is not guaranteed. A cancel that is never observed leaves the turn running to completion in the background, and a detached turn pays a KV read every five seconds for the chance to see one. The user's own view stops immediately either way; what is at risk is the spend, not the interface.

Abandoned turns now cost money that abandoned turns used to save. Closing the tab used to kill generation; it now pays for the rest of the answer in exchange for having it when you come back. That is the intended trade, and it is a real spend increase on turns nobody returns to.

`finaliseReadableStream` is gone entirely. Its cleanup hook fired on cancellation, which is precisely the moment that must no longer be treated as the end of the turn. Anything the turn holds is released through `onTurnEnd`, which `createChatTurnStream` and `createModelEnsembleStream` call from the run's own `finally` — the conversation thread lock above all, since releasing that on disconnect would let a second turn interleave with the first while it is still writing. The hook runs before the stream closes, so a follow-up sent the moment the client sees `done` cannot race the release.

The thread lock refuses when it cannot be taken. A deployment with no `CONVERSATION_COORDINATOR` binding still treats every thread as free, because there is no coordinator to disagree with. A binding that is configured but unreachable is a different case, and it used to be handled the same way: the call failed, the caller was told the lock was granted, and two turns could interleave writes on one conversation. That is the exact failure the coordinator exists to prevent, and it happened silently. A failed call now returns a refusal, so the caller raises `CONFLICT_ERROR` and the queue redelivers. The cost is that a Durable Object blip surfaces as a retryable conflict rather than passing unnoticed, which is the right way round: a retry is recoverable and a corrupted history is not.

iOS inherits durability without changing: it parses the same stream, ignores `: ping` as an SSE comment, and has no stop control to break. It has since gained its own `recoverDetachedTurn` in `apps/mobile/ios/Polychat/Services/TurnRecovery.swift`, so a dropped stream there recovers in place rather than waiting for the next conversation fetch.

Removing background mode is a breaking change for anyone who bookmarked `?mode=background` or has a conversation tagged with it. Those conversations load as ordinary chat.
