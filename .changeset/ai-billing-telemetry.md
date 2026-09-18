---
"@ngriffin_uk/polychat-ai-billing": minor
"@ngriffin_uk/polychat-ai-telemetry": minor
"@assistant/api": patch
---

Add the billing and telemetry primitives. `ai-billing` holds turn estimates, credit state, rate-card pricing, provider billable units, subscription entitlement, price drift detection, and the usage engine (ledger, credit admission, reservations, plan allowances, infrastructure and capability metering) behind a `UsageStore` contract the API implements over its repositories. `ai-telemetry` holds the logger, a `Telemetry` facade over Analytics Engine, PostHog, beacon and OTLP sinks, AI generation and training-example capture, and token usage helpers. The API takes its logger, metrics recorder and training-example capture from this package, and its `lib/` tree now holds only host infrastructure with every capability under `services/`.
