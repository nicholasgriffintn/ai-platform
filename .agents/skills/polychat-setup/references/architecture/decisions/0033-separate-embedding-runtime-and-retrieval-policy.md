# ADR 0033: Keep retrieval authority in D1 and preserve vector provenance

Status: Accepted.

Vector providers are retrieval accelerators, not access-control or document-lifecycle authorities.

## Decision

Keep embedding generation and vector storage as separate API-owned capabilities. Persist the exact provider target, credential fingerprint and vector-space compatibility fields with each document and chunk. Model, dimensions, metric or task-mode changes require a new compatible vector space and re-embedding.

Use model-driven `search_documents` rather than restoring the retired `use_rag` and `rag_options` request controls. Keep private document research separate from external paid web research.

Hydrate provider matches through authorised active D1 records before returning content. Never return raw provider metadata, private targets or credential fingerprints. Query historical targets with bounded fan-out and reciprocal-rank fusion; preserve partial-failure reporting and refuse unsupported target counts.

Managed personal embeddings support Vectorize and S3 Vectors. Derive scope from authentication with the stable `EMBEDDING_SCOPE_SECRET`; clients cannot choose namespaces or provider provenance. S3 Vectors uses the person's stored credentials, never platform AWS credentials for a user-selected target. Credential rotation must not redirect historical cleanup.

Reserve documents as `pending`, expose only `active` records, and mark `delete_pending` before provider deletion. Remove D1 state only after confirmed cleanup; retain uncertain writes for reconciliation against their original target. Apply the same discipline to built-in memory. Quarantine ambiguous legacy ownership rather than guessing.

Enforce content, metadata, batch and concurrency bounds at the shared schema and provider boundaries. Keep project memory in its authorised built-in scope; the personal embeddings API does not grant project retrieval. Disable unsupported video-search enrichment.

## Trade-off

Historical targets increase retrieval and cleanup cost, and changing credentials can make old targets temporarily unavailable. D1 hydration and explicit lifecycle state cost more than trusting a vector match, but prevent stale or cross-scope results.
