# ADR 0014: Keep retrieval authority in D1 and preserve vector provenance

Status: Implemented.

## Problem

Vector providers are retrieval accelerators. Treating them as access-control or document-lifecycle authorities would let a stale or cross-scope match return content the caller cannot see.

## Decision

Keep embedding generation and vector storage as separate API-owned capabilities. Persist the exact provider target, credential fingerprint and vector-space compatibility fields with each document and chunk. Model, dimensions, metric or task-mode changes require a new compatible vector space and re-embedding.

Use model-driven `search_documents` rather than request-level retrieval controls, and keep private document research separate from external paid web research.

Hydrate provider matches through authorised active D1 records before returning content. Never return raw provider metadata, private targets or credential fingerprints. Query historical targets with bounded fan-out and reciprocal-rank fusion; preserve partial-failure reporting and refuse unsupported target counts.

Treat reranking as a provider primitive, not as document-search internals. The `reranking` provider category accepts bounded opaque document IDs and text and returns the same IDs with relevance scores. `ai-functions` maps those scores back onto caller-owned typed documents. The API resolves an accessible reranking model centrally, hydrates and authorises D1 records before passing them to the reranker, applies reranking before `top_k`, and preserves the authorised baseline order when the optional capability is unavailable or fails. Provider scores never grant retrieval authority.

Managed personal embeddings support Vectorize, S3 Vectors and DynamoDB Vectors. Derive scope from authentication with the stable `EMBEDDING_SCOPE_SECRET`; clients cannot choose namespaces or provider provenance. S3 Vectors and DynamoDB Vectors use the person's stored credentials, never platform AWS credentials for a user-selected target, and credential rotation must not redirect historical cleanup.

Reserve documents as `pending`, expose only `active` records, and mark `delete_pending` before provider deletion. Remove D1 state only after confirmed cleanup and retain uncertain writes for reconciliation against their original target. Apply the same discipline to built-in memory, and quarantine ambiguous legacy ownership rather than guessing. Enforce content, metadata, batch and concurrency bounds at the shared schema and provider boundaries. Keep project memory in its authorised built-in scope; the personal embeddings API grants no project retrieval.

Index personal and project knowledge through the existing source tables, FTS5 and scoped vectors. Hydrate current source revisions and permissions before reranking and again before returning passages. Keep keyword passages searchable when semantic indexing fails.

Fence indexing with the existing task and document leases. Keep obsolete vector IDs and original provider targets until cleanup succeeds, including after source deletion; leave failed cleanup claims to expire before retrying.

Save notes and extracted pages as Sources in the current conversation scope; use `storeKnowledge` and report `storedKnowledge` for extraction. Store terminal repository results in the scope recorded by Activity. Copy existing saved content once during migration, while keeping the explicit embedding API responsible for its own records; source search has no embedding fallback or compatibility link.

Reuse recipe connector operations and `normaliseConnectorKnowledge` mappings for sync. Require the publisher's owned connection, enabled recipe capability and current workspace owner/admin role when publishing and committing content or checkpoints. Exclude shared records immediately when that authority is removed, the connection is revoked or the sync is paused.

## Consequences

Historical targets increase retrieval and cleanup cost, and changing credentials can make old targets temporarily unavailable. D1 hydration and explicit lifecycle state cost more than trusting a vector match, but prevent stale or cross-scope results.
