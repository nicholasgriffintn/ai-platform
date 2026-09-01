# Loop cost controls

One request can spend many model calls. This records where those loops are bounded, so a change that
removes a bound is visible as a change to this file rather than as a bill.

## Every loop and what stops it

| Loop                  | Bound                                                                                                                                                                                                | Enforced in                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Chat turn steps       | the request's own ceiling, the recipe and connector defaults, and `AGENT_MODE_CONFIGS[mode].maxSteps`; a turn under an active goal is raised to `GOAL_TURN_MAX_STEPS` unless the request set its own | `resolveTurnStepBudget`, `resolveModeMaxSteps`        |
| Agent loop steps      | that budget, extended once so a turn that hits it is asked for a final answer rather than cut off                                                                                                    | `executeAgentLoop`, `runAgentLoop`                    |
| Goal continuation     | `evaluateGoalContinuation`: stalls after two evidence-free turns, plus blocked, paused, and usage states                                                                                             | `packages/schemas/src/goals.ts`                       |
| Sandbox run loop      | `MAX_AGENT_STEPS`, `MAX_COMMANDS`, run timeout, and the run goal's own stall rule                                                                                                                    | sandbox worker constants, run goal iteration endpoint |
| Inbound channel turns | channel profile `maxSteps`, and one turn at a time per conversation                                                                                                                                  | `channels.ts`, `ConversationCoordinator`              |

Streaming is a transport, not a loop of its own (ADR 0022). A streamed turn and a buffered one draw the
same budget through the same loop, so there is one place to change a bound and one place it can be lost.

## A turn is admitted once, then never killed for balance

`checkUsageLimits` at the request boundary still throws for spent daily message counts — those survive
as the abuse guard for anonymous and free accounts. For a plan with `included_credits` configured,
`ConversationManager.admitTurn` runs once at that same boundary: it estimates the turn from the prompt
tokens at the model's input rate plus an output allowance (the model's `maxTokens`, capped at 8k
tokens' worth), admits it if the estimate fits `included + grace - spent - reserved` or overage is
enabled, and reserves the estimate on the usage balance. The reservation is released when the turn's
real spend lands (next to `recordModelTurnUsage` in `assistant-turn.ts`), and again defensively when
the stream closes; the release is idempotent, so both call sites are safe.

- **Agent loop**: `runAgentLoop` still re-checks before every step after the first, but the check is a
  runaway guard, not a balance check. An admitted turn stops only when the period's credit spend passes
  `included + grace + OVERRUN_CAP`, where `OVERRUN_CAP = max(25% of grace, 25 credits)`. The stop keeps
  the graceful close — `USAGE_LIMIT_NOTICE`, a `usage_limit_reached` finish reason, the finish gate
  allowed — so the user gets an answer explaining the stop rather than an error. Spend past the reserve
  inside an admitted turn accrues to `overrun_credit_micros` and is forgiven: a measurement, not a
  debt. While the plan has no credits configured, the per-step check falls back to the message-count
  behaviour unchanged.
- **Goals**: `readUsageLimitState` feeds `usageLimitsExhausted` into the continuation policy. With
  credits configured a goal stops at `exhausted` — past the reserve with no overage — never at
  `reserve`, and ends as `limit_reached` rather than erroring.

Usage increments per stored assistant message (`ConversationManager.addBatch`), so each loop step counts
against the allowance rather than the whole loop counting as one.

An unreadable limit is treated as **not** exhausted, so a storage blip cannot lock a paying user out.
The throwing check at the request boundary still applies.

## Counters are incremented relatively, never read-modify-written

A bound is only real if the counter behind it survives parallel requests. Every usage increment is one
statement that adds to the stored value and rolls the day over in the same `CASE`, so ten simultaneous
turns record ten. The repository owns that SQL — `UserRepository.incrementUsageCounters` and
`AnonymousUserRepository.incrementDailyCount` — and `UsageManager` only describes which counters move.

The plan a turn is billed against comes from `hasPlanEntitlement`, both when the turn is admitted and when
it is counted. Passing a hard-coded entitlement at increment time bills a free account at pro rates and lets
it past the pro gate.

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
2. Re-check usage before each unit of spend.
3. Make sure the work increments usage, not just the request, through a relative counter update.
4. If it holds the conversation, release it when the work actually finishes — a streaming response is
   still writing after its handler returns.
