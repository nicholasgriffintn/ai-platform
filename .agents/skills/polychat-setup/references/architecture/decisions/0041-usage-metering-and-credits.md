# ADR 0041: Meter vendor units and admit turns against credits

Status: Accepted.

Message counts cannot represent provider or infrastructure cost. Separate recorded spend from the decision to start work.

## Decision

Record vendor units and raw usage, then price into integer micro-USD and micro-credits. Derive model rates from the catalogue. Signed-in usage enters an idempotent, write-once ledger; insert an event and add its spend to the balance in one D1 batch. Entitlement changes may replace allowance fields, never accumulated spend.

Attribute project/workspace usage to the person running it. There is no workspace credit pool. Anonymous visitors use scoped running totals rather than the user ledger. BYOK model and hosted-tool events retain vendor cost with zero chargeable credits; capability and infrastructure work remains chargeable.

Use the persisted plan allowance. Missing or non-positive allowances refuse admission; there is no runtime fallback allowance or daily-message alternative. Free and anonymous plans have no reserve. Paid-plan reserve defaults are resolved by `planSeed.ts`. Publish allowances from `/plans`, not duplicated client constants.

Admit a chat turn once against estimated cost and outstanding reservations. Release its reservation on settlement and terminal paths. `ok`, `reserve` and opted-in `overage` permit work; `exhausted` refuses new work. Ordinary balance depletion does not stop an admitted turn, but the runaway ceiling and execution budgets still can. BYOK model turns skip model-cost admission; their other spend remains metered.

Use asynchronous ledger emission with inline fallback. Missing prices record zero estimated cost and a warning rather than failing the user's work. Reserve and settle longer-lived sandbox and realtime work idempotently. Stripe sells entitlement and optional overage; metering exists without it.

## Trade-off

Admission is an estimate over an asynchronous ledger, not an exact spending cap. Worker failure can leave reservations or lose unpersisted usage. Monitor estimated prices, unsettled work and overrun; do not promise an admitted turn can never stop. See [usage operations](../../operations/loop-cost-controls.md) and [Stripe setup](../../operations/stripe-billing.md).
