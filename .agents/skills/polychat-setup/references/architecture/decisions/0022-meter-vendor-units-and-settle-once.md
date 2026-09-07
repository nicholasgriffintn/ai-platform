# ADR 0022: Meter vendor units, admit against credits and settle once

Status: Implemented.

## Problem

Message counts cannot represent provider or infrastructure cost, and recorded spend must stay separate from the decision to start work. One stored run can also span retries, devices and durable-owner recovery, so a held estimate can be mistaken for actual spend, missing provider telemetry can be mistaken for zero cost, and duplicate completion must not settle twice.

## Decision

Record vendor units and raw usage, then price into integer micro-USD and micro-credits. Derive model rates from the catalogue. Signed-in usage enters an idempotent, write-once ledger; insert an event and add its spend to the balance in one D1 batch. Entitlement changes may replace allowance fields, never accumulated spend.

Attribute project and workspace usage to the person running it. There is no workspace credit pool. Anonymous visitors use scoped running totals rather than the user ledger. BYOK model and hosted-tool events retain vendor cost with zero chargeable credits; capability and infrastructure work remains chargeable.

Use the persisted plan allowance. Missing or non-positive allowances refuse admission; there is no runtime fallback allowance or daily-message alternative. Free and anonymous plans have no reserve, and paid-plan reserve defaults are resolved by `planSeed.ts`. Publish allowances from `/plans`, not duplicated client constants.

Admit a chat turn once against estimated cost and outstanding reservations. `ok`, `reserve` and opted-in `overage` permit work; `exhausted` refuses new work. Ordinary balance depletion does not stop an admitted turn, but the runaway ceiling and execution budgets still can. BYOK model turns skip model-cost admission; their other spend remains metered.

Attach the stable run ID and exact attempt to model, hosted-tool and capability ledger events, and keep three concepts distinct: the admission reservation is a temporary estimate, ledger events are actual recorded consumption, and settlement is the single idempotent release of that hold. Missing provider telemetry stays `unknown`; an estimated context count is not actual consumption. The assistant-turn finaliser is the normal settlement authority and marks a reservation settled only after usage is written or durably queued. Cancellation, terminal failure and durable-owner recovery release an unfinished hold through the same compare-and-set path. Chat-run holds expire after 24 hours, and scheduled maintenance releases expired holds so orphan recovery is bounded without changing admission or billing policy.

Use asynchronous ledger emission with inline fallback; missing prices record zero estimated cost and a warning rather than failing the user's work. Reserve and settle longer-lived sandbox and realtime work idempotently. Emit run-lifecycle analytics for duplicate commands, recovery, ownership loss, approval and cancellation latency and uncertain connector writes, carrying identifiers, attempt, classification and duration only — never prompts, message content, tool arguments, credentials or provider payloads. Stripe sells entitlement and optional overage; metering exists without it.

## Consequences

Admission is an estimate over an asynchronous ledger, not an exact spending cap, and Worker failure can leave reservations or lose unpersisted usage. Do not promise that an admitted turn can never stop. Ledger entries created before run attribution have no run identity and remain in account or workspace reporting rather than being guessed onto a run. Providers that omit usage stay visibly unknown, and queued ledger processing can briefly show a settled reservation with consumption still processing. See [usage operations](../../operations/loop-cost-controls.md) and [Stripe setup](../../operations/stripe-billing.md).
