# Loop cost controls

One request can spend many model calls. This records where those loops are bounded, so a change that
removes a bound is visible as a change to this file rather than as a bill.

Metering is now the regression test for these bounds. Every loop below spends something the ledger
prices, so a bound that quietly disappears shows up as a cost curve in `usage_event` before it shows up
on an invoice. When you change a bound here, check the corresponding events still appear at the scale
this file claims.

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

## A turn is admitted once, then never killed for balance

`checkUsageLimits` at the request boundary still throws for spent daily message counts — those survive
as the abuse guard for anonymous and Free accounts. For a plan with `included_credits` configured,
`ConversationManager.admitTurn` runs once at that same boundary: it estimates the turn from the prompt
tokens at the model's input rate plus an output allowance (the model's `maxTokens`, capped at 8k
tokens' worth), admits it if the estimate fits `included + grace - spent - reserved` or overage is
enabled, and reserves the estimate on the usage balance. A BYOK turn skips admission entirely. The
reservation is released when the turn's real spend lands (next to `recordModelTurnUsage` in
`assistant-turn.ts`), and again defensively in the streaming, ensemble, and non-stream `finally`
paths; the release is idempotent, so every call site is safe.

Every provider completion inside a loop still records its own vendor units through
`recordModelTurnUsage`. The ordinary agent transport, model-ensemble secondaries, and panel member and
conclusion calls use that seam. Step budgets remain the hard in-turn cost bound.

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

Both coordinator clients now count their calls as `do_requests` on the request meter, so this claim is
measurable rather than asserted: a turn that emits far more than two `do_requests` means something
started calling the coordinator inside a loop.

The lock carries a five-minute lease, so a worker that dies mid-turn cannot wedge a conversation and
cannot leave an object spinning.

Nothing calls the coordinator inside a loop. `ChatOrchestrator.process` is the only place a turn acquires,
and it releases through `onTurnEnd` when the turn itself finishes — not when the client stops reading, which
a detached turn outlives — so a long tool chain is still two DO calls in total.

## What the ledger measures, and where

Infrastructure spend is attributed per request rather than per call. `infraMeteringMiddleware` opens an
`AsyncLocalStorage` meter for the request, `BaseRepository` adds D1 `rows_read` and `rows_written` from
every result's `meta`, the two Durable Object clients add `do_requests`, `VectorizeEmbeddingProvider`
adds queried and stored dimensions, and `TaskService` adds `queue_operations` for each enqueue. At the
end of the request the middleware drains the meter and writes one `infrastructure` usage event per unit.
Infrastructure is charged whether or not the user brought their own key.

Two loops outlive their request, so they are metered by reservation and settlement instead:

| Work             | Reserved at                                  | Settled by                                                              |
| ---------------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| Sandbox run      | dispatch, priced for the configured timeout  | the worker's duration report on every terminal path                     |
| Realtime session | session mint, 300s at the model's audio rate | a `realtime_reconciliation` task scheduled for the cap plus two minutes |

Both settlements are idempotent through `unique(kind, ref_id)` on `usage_reservation`, so a redelivered
task or a repeated report cannot double-charge or double-release.

Capability calls are metered at the registry boundary. `ProviderLibrary.resolve` wraps the resolved
provider, so a capability is metered by its registration rather than by each provider remembering to
report. Workers AI neurons are the exception to per-request attribution: the `AI` binding returns no
cost, so neurons are captured only in the nightly account-level reconciliation.

The nightly `infra_reconciliation` task queries the Cloudflare GraphQL Analytics API for account totals
and writes `infra_cost_daily` rows alongside the sum of what we attributed for the same day. A gap
between the two columns is the signal that attribution is drifting from the real bill. Without
`CLOUDFLARE_ANALYTICS_API_TOKEN` the task logs and no-ops rather than failing.

## When adding a new loop

1. Give it a bound that does not depend on the model behaving.
2. Record every provider call through the vendor-unit ledger, including hidden synthesis and routing calls.
3. Keep the daily message counter at one increment per top-level response; never use it to estimate cost.
4. If it holds the conversation, release it when the work actually finishes — a streaming response is
   still writing after its handler returns.
5. If the work outlives its request, reserve at the start and settle idempotently at the end. A run that
   ends without settling is a bug, not a rounding error.
