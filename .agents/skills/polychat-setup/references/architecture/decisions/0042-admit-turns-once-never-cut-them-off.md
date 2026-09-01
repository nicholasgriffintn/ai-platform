# ADR 0042: Admit a turn once, then never cut it off for balance

## Status

Accepted

## Context

[ADR 0041](0041-usage-metering-and-credits.md) records what work costs and deliberately stops there: metering is not enforcement. This decision is the enforcement half, and it has to answer one question that the ledger cannot — what happens to a person who runs out of credits halfway through an answer.

Today's behaviour answers it badly. The daily message counter is the only guard, so `runAgentLoop` re-checks it before every step and truncates the turn with `USAGE_LIMIT_NOTICE` when it trips. The failure lands at the worst possible moment: a long agent turn dies after reading a repository and running its tools, and the person loses the work rather than the credit. Every mid-turn balance check has this shape, so simply swapping the counter for a credit balance would reproduce the defect with better arithmetic.

The obvious alternatives both fail.

**Check the balance before every step, as today.** Precise, and it never overspends. But it makes the cutoff a normal event rather than an exception, and the more expensive the turn the more likely it dies mid-thought. Precision here is bought with the one experience we cannot ship.

**Check nothing until the period rolls over.** No cutoffs, and trivially simple. But a runaway agent loop on a misconfigured recipe can spend without any bound at all, and the first anyone hears of it is the invoice.

## Decision

Split the decision in two. **Admission** decides whether a turn may start. **A runaway guard** decides whether a turn that is already running has gone wrong. Nothing else may stop a turn for balance.

`ConversationManager.admitTurn` runs once, at the request boundary, next to the daily abuse guard. It estimates the turn from the prompt token count at the model's input rate plus an output allowance — the model's own `maxTokens`, capped at 8k tokens' worth — and admits when the estimate fits `included + grace - spent - reserved`, or when the balance has overage enabled. The estimate is then reserved additively on `usage_balance.reserved_credit_micros`, so concurrent turns on one account see each other's commitments rather than each admitting against the same headroom. The reservation is released when real spend lands, and again defensively when the stream closes; release is idempotent, so every call site is safe and none is load-bearing on its own.

An admitted turn is never killed for balance. The per-step check in `runAgentLoop` remains, but its meaning changes: it fires only past `included + grace + max(25% of grace, 25 credits)`, which is a runaway ceiling rather than a balance. Spend past the reserve inside an admitted turn accrues to `overrun_credit_micros` and is forgiven — it is a measurement of how far our estimate was wrong, not a debt owed by the user. When it does fire it keeps the graceful close: a final answer, `USAGE_LIMIT_NOTICE`, and a `usage_limit_reached` finish reason.

The four credit states are the whole vocabulary. `ok`, `reserve`, and `overage` all continue working; only `exhausted` refuses, and it refuses **new** turns only, never one in flight. Goal continuation and project tasks read the same states and stop at `exhausted`, never at `reserve`, because a reserve is a heads-up rather than a failure.

Enforcement is off until a plan configures it. A plan with no `included_credits` is never enforced: `admitTurn` admits everything and reserves nothing, no `credits` object appears in `usage_limits`, and the message-count behaviour is byte-for-byte what it was. Grace defaults to `max(10% of included, 50 credits)` when a plan configures included credits but leaves grace null, so configuring one number is enough to get a sane reserve.

## Consequences

Admission is an estimate, so it is wrong in both directions and must be. A turn that spends far more than its estimate finishes anyway and shows up as overrun; a turn that spends far less has briefly held headroom it did not need. Both are preferable to a cutoff, and `overrun_credit_micros` is the metric that says how wrong the estimate typically is — a large and growing overrun is a signal to raise the output allowance, not to tighten the guard.

Reservations can leak. A worker that dies between admission and every release leaves the hold in place until the period resets, quietly shrinking that user's headroom. The releases are idempotent and placed on every terminal path precisely because the alternative — a reconciliation sweep — is more machinery than the exposure justifies at one turn's estimate per leak.

BYOK turns skip admission entirely, because model spend on the user's own key is free (ADR 0041) and reserving against it would refuse turns that cost us nothing. Infrastructure spend from those turns still lands in the ledger and still counts toward the balance.

Enforcement reads the balance the ledger projects, so it inherits the ledger's asynchrony: a turn admitted a second after another turn finished may not see that spend yet. The reserve absorbs exactly this, which is the second reason for holding an estimate rather than checking spent credits alone.

Shipping dark means the first real test of these numbers happens when a plan is configured, not when this lands. The included and grace values a plan chooses are the actual product decision; this ADR only fixes what those numbers mean.
