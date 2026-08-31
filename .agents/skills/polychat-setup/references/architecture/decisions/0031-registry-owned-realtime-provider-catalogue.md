# ADR 0031: Registry-owned realtime provider catalogue

## Status

Accepted.

## Context

Realtime provider presentation previously lived in a shared compile-time manifest. Backend adapters, provider registrations and the model catalogue could change independently, while the browser continued to present the stale manifest as authoritative. It also could not distinguish a registered provider that was ready for the current person from one that needed an API key or whose default model was inaccessible.

Moving every provider fact into the browser would expose backend configuration detail and keep the duplication. Inventing a provider-shaped loading fallback would be equally misleading because the browser could briefly present a provider and model that the signed-in account cannot use.

## Decision

Make each backend realtime adapter own a typed public descriptor and private configuration requirements. Build authenticated `GET /realtime/providers` only from adapters present in the provider registry, validate that every descriptor ID matches its registration, and project the current person's model access plus platform or user-key configuration into `ready`, `setup_required`, or `unavailable` without returning key names or values.

Keep protocol-specific browser behaviour in `packages/library-realtime`. Enrich fetched descriptors with those client adapters rather than moving WebRTC or WebSocket implementation into the API contract. Downgrade a WebSocket provider to unavailable when this browser build has no matching protocol adapter. Represent loading and empty states explicitly; never substitute another provider for an unknown ID.

Live currently belongs to personal Chat. Keep the catalogue contract independent of project scope so a future Work surface can reuse it without creating a second provider vocabulary; this decision does not add Live controls to Work. Reconcile provider and default model together when Live changes provider, invalidate both model and realtime catalogue queries after provider-key mutations, and keep session creation as the authoritative model-access and credential boundary.

Retain the old compile-time manifest exports with their original schema and lookup semantics as deprecated compatibility APIs. Runtime application code must not consume them.

## Consequences

- Adding or removing a realtime provider changes its adapter and registry registration; the browser no longer needs a parallel provider list.
- Catalogue reads add one authenticated, cached request and inspect the current person's provider-key metadata and accessible model catalogue.
- Provider-key mutations invalidate both catalogue and model caches. Readiness can still change outside this browser session, so session creation revalidates the provider, model and credentials and fails closed.
- A catalogue request in flight renders an explicit loading state; failure or an empty result renders no provider rather than a synthetic default.
- Client protocol adapters remain keyed by provider ID. A newly registered WebSocket provider without corresponding browser protocol behaviour is visible as unavailable until that adapter is added and validated.
- Deprecated manifest exports remain duplicated until the next major schema release, but are isolated from runtime selection.
