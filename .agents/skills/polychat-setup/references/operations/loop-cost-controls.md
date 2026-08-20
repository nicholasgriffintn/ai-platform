# Loop cost controls

One request can spend many model calls. This records where those loops are bounded, so a change that
removes a bound is visible as a change to this file rather than as a bill.

## Every loop and what stops it

| Loop                        | Bound                                                                                                    | Enforced in                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Agent loop steps            | `AGENT_MODE_CONFIGS[mode].maxSteps`, clamped by any requested `max_steps`                                | `resolveModeMaxSteps`, `executeAgentLoop`             |
| Streaming tool continuation | `evaluateTurnContinuation`: step budget, all results continuable                                         | `turn-continuation.ts`                                |
| Goal continuation           | `evaluateGoalContinuation`: stalls after two evidence-free turns, plus blocked, paused, and usage states | `packages/schemas/src/goals.ts`                       |
| Sandbox run loop            | `MAX_AGENT_STEPS`, `MAX_COMMANDS`, run timeout, and the run goal's own stall rule                        | sandbox worker constants, run goal iteration endpoint |
| Inbound channel turns       | channel profile `maxSteps`, and one turn at a time per conversation                                      | `channels.ts`, `ConversationCoordinator`              |

## Usage limits are checked as the work is spent, not once per request

`checkUsageLimits` at the request boundary only covers the first model call. Every loop that can spend
more re-checks before spending the next one:

- **Agent loop**: `runAgentLoop` re-checks before each step after the first. Exhaustion throws
  `USAGE_LIMIT_ERROR` and the loop stops.
- **Streaming continuation**: `continueStreamingTurn` checks before recursing, and stops instead.
- **Goals**: `readUsageLimitState` feeds `usageLimitsExhausted` into the continuation policy, so a goal
  ends as `limit_reached` rather than erroring.

Usage increments per stored assistant message (`ConversationManager.addBatch`), so each loop step counts
against the allowance rather than the whole loop counting as one.

An unreadable limit is treated as **not** exhausted, so a storage blip cannot lock a paying user out.
The throwing check at the request boundary still applies.

## Durable Object cost

`ConversationCoordinator` is called **twice per turn** (acquire, release) and twice per compaction.
There are no alarms, no WebSockets, no polling, and no per-step or per-token calls. Each call performs
at most three storage operations on a single object.

The lock carries a five-minute lease, so a worker that dies mid-turn cannot wedge a conversation and
cannot leave an object spinning.

Nothing calls the coordinator inside a loop. Continuations recurse below `ChatOrchestrator.process`,
which is the only place a turn acquires, so a long tool chain is still two DO calls in total.

## When adding a new loop

1. Give it a bound that does not depend on the model behaving.
2. Re-check usage before each unit of spend.
3. Make sure the work increments usage, not just the request.
4. If it holds the conversation, release it when the work actually finishes — a streaming response is
   still writing after its handler returns.
