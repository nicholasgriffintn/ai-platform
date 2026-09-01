# Loop cost controls

One request can spend many model calls. This records where those loops are bounded, so a change that
removes a bound is visible as a change to this file rather than as a bill.

Metering is now the regression test for these bounds. Every loop below spends something the ledger
prices, so a bound that quietly disappears shows up as a cost curve in `usage_event` before it shows up
on an invoice. When you change a bound here, check the corresponding events still appear at the scale
this file claims.

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

## Usage limits are checked as the work is spent, not once per request

`checkUsageLimits` at the request boundary only covers the first model call. Every loop that can spend
more re-checks before spending the next one:

- **Agent loop**: `runAgentLoop` re-checks before every step after the first. Exhaustion closes the turn
  with `USAGE_LIMIT_NOTICE` and a `usage_limit_reached` finish reason, and allows the finish gate, so the
  user gets an answer explaining the stop rather than an error.
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
2. Re-check usage before each unit of spend.
3. Make sure the work increments usage, not just the request.
4. If it holds the conversation, release it when the work actually finishes — a streaming response is
   still writing after its handler returns.
5. If the work outlives its request, reserve at the start and settle idempotently at the end. A run that
   ends without settling is a bug, not a rounding error.
