# ADR 0035: Resolve model tiers once, on the server

Status: Implemented.

## Problem

Model tier resolution was duplicated in clients even though the available candidates depend on account plan, provider credentials, model readiness and runtime. Those inputs can differ between clients, so the same tier could render one model and execute another.

## Decision

The API resolves the executable model for every tier and role through the server-side model policy and exposes the result from `GET /models/tiers`. The response includes an explicit nullable slot for every supported runtime, tier and role; clients fetch it alongside the model queries and render the returned candidates without reimplementing eligibility or fallback order.

The shared schema remains the source of the candidate lineup and runtime vocabulary. The server owns account-specific selection, while clients continue to own only local runtime discovery and presentation.

## Consequences

- Web and native clients can present the same account-specific resolution.
- Empty runtimes and unavailable tier roles are represented explicitly instead of silently falling back to hosted models.
- Provider access changes require invalidating the model and tier queries together.
- Adding a runtime or role requires an API response and client rendering update, with the shared schema keeping the candidate order in one place.
