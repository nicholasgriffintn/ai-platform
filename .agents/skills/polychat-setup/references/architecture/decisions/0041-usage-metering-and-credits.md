# ADR 0041: Meter in vendor units, bill in credits

## Status

Accepted

## Context

Polychat bills by counting messages. A daily message counter on `user` and `anonymous_user` governs every paid surface, and the numbers behind it were never a measure of cost. One message can be a two-token Haiku reply or a Sonnet agent turn that reads a repository, writes a prompt cache, runs a hosted search, and burns a sandbox container for twenty minutes. Those cost roughly four orders of magnitude apart and count the same.

The result is that we cannot answer basic questions. We do not know what a conversation cost, which models lose money, what infrastructure a project consumes, or whether a plan's price covers the work it admits. We cannot offer overage, because there is nothing to charge for. We cannot let someone bring their own key and pay only for infrastructure, because infrastructure is not measured. And a pricing mistake is unrecoverable, because nothing records what the provider actually reported.

Counting messages also fails the other way. Because the counter is the only guard, `runAgentLoop` re-checks it between steps and truncates a turn mid-flight when it trips. People lose work at the moment the assistant is being most useful.

Three shapes were considered.

**Keep message counts and add multipliers.** Cheap, and it preserves the current code. But a multiplier is a guess layered on a unit that was already wrong, it cannot express cached input, container-seconds, or hosted tool calls, and it gives Stripe nothing meaningful to meter.

**Bill vendor cost directly in USD.** Honest, and it needs no unit of account. But it exposes provider prices to users, forces a repricing every time a provider moves, makes margin invisible, and turns every plan change into a spreadsheet exercise. Storing money as floats invites rounding drift, and storing per-vendor currency invites conversion bugs.

**Meter in vendor units and bill in credits.** Chosen.

## Decision

Record one `usage_event` per billable unit of work, in the vendor's own unit — input tokens, cached input tokens, container vCPU-seconds, hosted search requests — with the vendor's raw usage payload preserved verbatim. Price each event through a rate card into integer micro-USD, then convert once into integer micro-credits at a published rate: one credit is one US cent of vendor cost at margin 1.0. Credits are the unit of account users see; vendor units are the unit of record we keep.

Money never touches a float. `cost_micros` is integer micro-USD, `credit_micros` is integer micro-credits, and rounding happens exactly once, at conversion, with `Math.round`. A balance is the sum of integers.

`usage_event` is write-once. `usage_balance` is a derived aggregate, one row per user per period, and **every mutation is `SET column = column + ?`**. There is no read-modify-write in the ledger, because concurrent turns on the same account otherwise lose spend silently — the exact defect this work exists to fix.

The rate card lives in `packages/schemas/src/pricing`. Model token rates are **derived** from the existing model catalogue rather than migrated out of it: an adapter turns a `ModelConfigItem` into rate entries, so the catalogue stays the single place a model is described. Cloudflare rates are a static table. A rate lookup that misses is not an error: it records the event with `cost_micros = 0` and `estimated = true`, and warns. Nothing in a billing path may throw, and no user request may fail because pricing data is absent.

Emission is asynchronous. A request enqueues a `usage_rollup` task and the queue consumer inserts the events and aggregates the balance. If enqueueing fails the write happens inline. An event may be lost only if D1 itself is unavailable, and never at the cost of the user's turn.

Attribution always carries `user_id`. Where a conversation belongs to a project we resolve and store `project_id` and the project's `workspace_id`, so Work spend can be billed to a workspace without re-deriving history.

BYOK is free for AI API usage: `model` and `hosted_tool` events with `byok = true` record `cost_micros` for visibility but carry `credit_micros = 0` and `billable = false`. Infrastructure is always charged, because we pay for it whoever owns the model key.

## Consequences

Idempotency is a schema-level guarantee, not a convention. Every event carries a unique `idempotency_key` and inserts use `ON CONFLICT DO NOTHING`, so a redelivered queue message inserts nothing and moves no credits. Callers must therefore mint a key that is stable for the work, not for the attempt.

The ledger is repriceable. Because `raw` holds what the provider actually said and `rate_version` records which rate applied, a pricing bug is a backfill rather than a write-off. This is the main reason to keep the vendor payload rather than only our normalised view of it.

Credits are a second number to explain. A user now sees credits where they saw messages, and the conversion is arbitrary until they trust it. The chosen scale keeps ordinary work legible — a Haiku reply is about 0.06 credits, a heavy agent turn about 190, a two-hour sandbox container about 5.6 — which is the point of picking one cent rather than one dollar.

Metering is not enforcement. This decision records what work costs; it does not decide who may do it. Admission, the reserve, the overrun ceiling, and the no-cutoff rule are separate and build on the ledger rather than the other way round. Daily message counts survive only as an abuse guard for anonymous and free accounts.

Deriving model rates from the catalogue means an unpriced model meters silently at zero rather than blocking a turn. That is the correct trade for a billing path, but it makes `estimated` a metric worth watching: a rising share of estimated events is a catalogue gap, not noise.
