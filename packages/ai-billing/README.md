# @ngriffin_uk/polychat-ai-billing

Pricing and billing rules: turn cost estimates, credit state, usage pricing from rate cards, billable units extracted from provider usage, runaway detection, subscription entitlement, Stripe checkout guards, and catalogue price drift against a reference feed.

```ts
import {
  estimateTurnCreditMicros,
  extractProviderBillableUsage,
  priceUsageDraft,
  resolveCreditState,
} from "@ngriffin_uk/polychat-ai-billing";

const estimate = estimateTurnCreditMicros({ promptTokens, modelConfig });
const state = resolveCreditState({
  includedCreditMicros,
  graceCreditMicros,
  spentCreditMicros,
  reservedCreditMicros,
  overageEnabled,
});
const units = extractProviderBillableUsage(provider, signals, { hasRate });
const priced = priceUsageDraft(draft, { onMissingRate: (query) => logger.warn("no rate", query) });
```

`priceUsageDraft` returns cost and credit micros, the rate version, and whether the usage was estimated or BYOK-exempt. `detectModelPriceDrift` compares catalogue prices with a reference list inside `MODEL_PRICE_DRIFT_TOLERANCE` so the catalogue sync can flag stale prices.

`resolvePlanId`, `hasPlanEntitlement` and `resolvePlanEntitlementMicros` answer plan tier and allowance questions, and the Stripe helpers classify meter and subscription item errors.

## Usage engine

The ledger, credit admission, reservations, plan allowances and balance snapshots live here too, behind a `UsageStore` contract the host implements over its database. A `UsageRuntime` bundles the store with an optional `publisher` (balance-change notifications), `enqueueRollup` (queue delivery for ledger rows) and `resolveModelConfig` (host model lookup for rates).

```ts
import {
  admitTurn,
  emitUsageEvents,
  finishUsageReservation,
  recordModelTurnUsage,
  userCreditActor,
} from "@ngriffin_uk/polychat-ai-billing";

const runtime = { store, publisher, enqueueRollup, resolveModelConfig };

const admission = await admitTurn(runtime, { actor: userCreditActor(7), estimatedCreditMicros });
await recordModelTurnUsage(runtime, { actor, usage, model, provider, completionId });
await finishUsageReservation(runtime, { kind: "sandbox", refId: runId, outcome: "settled" });
```

`emitUsageEvents` prices drafts, commits anonymous spend directly, and either queues user rows for `applyUsageRollup` or writes them inline. Infrastructure and capability metering build drafts the same way (`emitInfraUsage`, `recordCapabilityCall` with `DEFAULT_CAPABILITY_METERS`), and `createRequestInfraMeter` accumulates per-request D1, Durable Object and Vectorize counts for the host to flush.
