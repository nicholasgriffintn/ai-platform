# Loop cost controls

One request can spend many model calls. This records where those loops are bounded, so a change that
removes a bound is visible as a change to this file rather than as a bill.

## Every loop and what stops it

| Loop                        | Bound                                                                                                                                                                                                | Enforced in                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Chat turn steps             | the request's own ceiling, the recipe and connector defaults, and `AGENT_MODE_CONFIGS[mode].maxSteps`; a turn under an active goal is raised to `GOAL_TURN_MAX_STEPS` unless the request set its own | `resolveTurnStepBudget`, `resolveModeMaxSteps`        |
| Agent loop steps            | that budget, extended once so a turn that hits it is asked for a final answer rather than cut off                                                                                                    | `executeAgentLoop`, `runAgentLoop`                    |
| Goal continuation           | `evaluateGoalContinuation`: stalls after two evidence-free turns, plus blocked, paused, and usage states                                                                                             | `packages/schemas/src/goals.ts`                       |
| Sandbox run loop            | `MAX_AGENT_STEPS`, `MAX_COMMANDS`, run timeout, and the run goal's own stall rule                                                                                                                    | sandbox worker constants, run goal iteration endpoint |
| Inbound channel turns       | channel profile `maxSteps`, and one turn at a time per conversation                                                                                                                                  | `channels.ts`, `ConversationCoordinator`              |
| Detached turn cancel checks | the turn's own lifetime: one KV read a second for the first thirty seconds a turn is detached, then one every five seconds until it ends                                                             | `watchDetachedTurnCancellation`                       |

Streaming is a transport, not a loop of its own (ADR 0022). A streamed turn and a buffered one draw the
same budget through the same loop, so there is one place to change a bound and one place it can be lost.

## Admission is checked once; spend is metered per provider call

`checkUsageLimits` at the request boundary protects the anonymous and Free daily message allowance. It does
not stop a paid turn and does not re-check between model steps. A top-level assistant response records one
message-counter increment after it is stored, so an agent loop cannot truncate itself halfway through useful
work.

Every provider completion inside a loop still records its own vendor units through
`recordModelTurnUsage`. The ordinary agent transport, model-ensemble secondaries, and panel member and
conclusion calls use that seam. Step budgets remain the hard in-turn cost bound; the monthly credit balance
is accounting state until a separate admission/reservation decision is implemented.

## The abuse guard and ledger both update atomically

A bound is only real if the counter behind it survives parallel requests. Every usage increment is one
statement that adds to the stored value and rolls the day over in the same `CASE`, so ten simultaneous
turns record ten. The repository owns that SQL — `UserRepository.incrementUsageCounters` and
`AnonymousUserRepository.incrementDailyCount` — and `UsageManager` only describes which counters move.

The ledger separately inserts each idempotent `usage_event` and increments the matching `usage_balance` in
one transactional D1 batch. The balance statement runs only when the preceding event insert changed one
row, so a redelivery cannot charge twice and a partial failure cannot strand an event without its spend.

## Durable Object cost

`ConversationCoordinator` is called **twice per turn** (acquire, release) and twice per compaction.
There are no alarms, no WebSockets, no polling, and no per-step or per-token calls. Each call performs
at most three storage operations on a single object.

The lock carries a five-minute lease, so a worker that dies mid-turn cannot wedge a conversation and
cannot leave an object spinning.

Nothing calls the coordinator inside a loop. `ChatOrchestrator.process` is the only place a turn acquires,
and it releases through `onTurnEnd` when the turn itself finishes — not when the client stops reading, which
a detached turn outlives — so a long tool chain is still two DO calls in total.

## When adding a new loop

1. Give it a bound that does not depend on the model behaving.
2. Record every provider call through the vendor-unit ledger, including hidden synthesis and routing calls.
3. Keep the daily message counter at one increment per top-level response; never use it to estimate cost.
4. If it holds the conversation, release it when the work actually finishes — a streaming response is
   still writing after its handler returns.
