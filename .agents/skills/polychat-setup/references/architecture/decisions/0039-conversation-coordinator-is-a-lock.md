# ADR 0039: The conversation coordinator is a lock, and it covers every history mutation

## Status

Accepted. Completes the coordinator introduced alongside [ADR 0024](0024-turns-outlive-the-connection.md), and retires the instruction queue that shipped with it.

## Context

`ConversationCoordinator` arrived with thread-scoped goals, to make "every operation that mutates a conversation's history serialise" rather than race a turn in flight. It shipped as two mechanisms.

The first is a lock: `/acquire` takes a conversation for one operation under a five-minute lease, `/release` gives it back. `ChatOrchestrator.process` takes it for a turn and compaction takes it for a summary, so those two stopped racing each other.

The second is an instruction queue: `/instructions` appends work, `/claim` hands out the next piece under a policy in `resolveNextInstruction` where a cancel pre-empts, a goal continuation is dropped when real user work waits behind it, and everything else runs first-in-first-out when the thread is idle. Nothing ever called it. It was written, later given atomic mutations, tested, and never wired to a caller in either direction.

Meanwhile the lock only ever covered two of the paths that write history. Six others write outside it: replacing a conversation's messages from `PATCH /chat/completions/:id`, recording a person's answers to a task runner's questions, recording a task tool approval, replaying an approved connector operation before the turn that follows it, writing an async invocation's result when it finally lands, and persisting a realtime session's compaction. ADR 0024 widened the window these race in: a turn now outlives the connection that started it, so "the person is doing something else while a turn is still writing" is the ordinary case rather than the edge one. Replacing a conversation's messages is the sharp one — it deletes and re-inserts the whole list in one transaction, so a turn that appends beside it loses the message it just wrote.

## Decision

**The coordinator is a lock. Every entry point that mutates a conversation's history takes it.**

Add `withThreadLock` and `withThreadLockIfFree` to the coordinator client, and route every out-of-turn writer through them, so acquisition, release-on-failure, and the refusal message live in one place rather than at each call site. `ChatOrchestrator` keeps its own acquire and release because a turn outlives its handler and must release through `onTurnEnd` (ADR 0024), not through a scope that returns first.

Take the lock at the operation's entry point, never inside `ConversationManager`. The lock is a plain mutex with no owner identity, so a re-entrant acquisition inside a turn that already holds it would deadlock. Entry points are HTTP route services and queue handlers, which are exactly the places that are never already inside a turn.

Choose the response to a busy thread by what the caller can do about it:

- An interactive route refuses with `CONFLICT_ERROR`, matching what a second turn already does. Editing messages, answering a task's questions, resolving a task approval, and replaying an approved connector operation all refuse.
- Work a queue will redeliver skips and lets the queue bring it back. Async invocation polling re-queues itself on its existing schedule.
- Opportunistic work skips. A `GET` that refreshes pending async invocations returns what it has, and realtime session compaction waits for the next opportunity rather than failing a live session.

**Delete the instruction queue.** Every kind it was built to schedule now has an owner elsewhere:

| Instruction         | Owner today                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `user_message`      | the lock, refusing with `CONFLICT_ERROR`; queue-delivered turns are redelivered (ADR 0024) |
| `goal_continuation` | the turn's own loop — continuation stopped being a separate scheduled unit (ADR 0022)      |
| `compact`           | the lock                                                                                   |
| `goal_*` lifecycle  | in-turn tool calls under the goal finish gate (ADR 0022)                                   |
| `title`             | conversation metadata, which is not history                                                |
| `cancel`            | a KV flag read only after the client detaches (ADR 0024)                                   |

Replace `threadInstructionKindSchema` with `threadOperationSchema`, naming the operations that can actually hold the thread. The value is reported back on refusal, so a conflict can say what the conversation is busy with.

## Consequences

- Two operations can no longer interleave writes on one conversation, whichever entry point they arrive through.
- A person editing a conversation while a detached turn is still finishing gets a retryable conflict instead of a silently dropped message.
- The Durable Object call profile grows from two calls per turn and two per compaction to two per history-mutating operation. All are short, and none sits inside a loop; see [loop-cost-controls.md](../../operations/loop-cost-controls.md).
- A future need to queue thread work rather than refuse it starts from the refusal semantics ADR 0024 chose, and would be designed against a caller that wants it. The deleted policy is recoverable from history if that day comes.

## Trade-offs

Refusal is cruder than queueing. A person who answers a task's questions at the exact moment its run is still writing is told to try again, where a queue would have accepted the answer and run it in order. That is the same trade ADR 0024 already made for a second turn, and the alternative — keeping an unwired queue in the tree in case someone drains it later — bought nothing for two releases.

The lock is not re-entrant, so this decision depends on every caller being an entry point. A future writer added deep inside turn execution would deadlock rather than refuse. The seam functions are the place to add an owner token if that becomes necessary.
