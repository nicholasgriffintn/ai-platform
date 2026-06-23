# ADR 0002: Cache Artificial Analysis model data

## Status

Accepted.

## Context

The models.dev sync previously used a review script that asked Polychat to inspect generated catalogue diffs and propose router metadata changes. That mixed code review with model intelligence, depended on patch generation, and did not create reusable benchmark data for the product.

Artificial Analysis provides benchmark, pricing, and performance data that can support model selection later. The Free API key must stay server-side, responses are rate-limited, and displayed data requires attribution.

## Decision

Store Artificial Analysis language model data in D1 through `ArtificialAnalysisRepository`. The models.dev sync script notifies an authenticated API admin route after completion. The API queues an `artificial_analysis_ingest` task, fetches the Free-tier `/api/v2/language/models/free` endpoint server-side, stores the raw benchmark and pricing fields, then schedules `artificial_analysis_scoring` one hour later to derive strengths and bounded scores.

Expose cached data through the models API with explicit Artificial Analysis attribution. Do not call Artificial Analysis from client code.

## Trade-offs

The cache may lag behind Artificial Analysis by up to the sync cadence plus the delayed scoring window. That is acceptable because it avoids client-side keys, respects rate limits, and gives other backend features a stable data source.
