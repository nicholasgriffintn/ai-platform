# ADR 0011: Resolve models, tiers and readiness on the server

Status: Implemented.

## Decision

Model selection, readiness, and tier resolution are now server-owned and account-scoped, not client-recomputed.
Clients render the API result and do not reimplement fallback order or execution eligibility.

The API resolves each request’s executable model list from:

- account plan and readiness,
- runtime capabilities (hosted, browser, local),
- provider support and account credentials,
- role and request context.

Model readiness is explicit (`ready`, `setup_required`, `unavailable`, `unknown`) with refresh windows.
Unavailable or expired states block execution unless the caller provides a valid replacement.

Providers define generation defaults, hard limits, and protocol constraints.
Clients keep caller intent, but may only send optional settings that are explicitly supplied.

## Why this merges 0035

An earlier separate record on model-tier resolution duplicated this decision.
Its intent is now covered here and no longer maintained separately.

## Consequences

- Server and clients agree on the same tier result and empty/unsupported candidates remain explicit.
- Client routing is deterministic and easier to test; model scoring/prompt-based pre-selection is removed.
- Plan or access changes require revalidation of model and tier responses together.
