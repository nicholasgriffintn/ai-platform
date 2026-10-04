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

Index personal and project knowledge from the `source` domain through `source_index` and `source_chunk`. Combine D1 FTS5 keyword matches with scoped vectors using reciprocal-rank fusion, then hydrate current source revisions before reranking and again before returning passages. Transition note creation and document-search tools to sources; migrate existing active personal document content into sources without a legacy search fallback.

Fence writes with task leases and source revisions. Keep obsolete index records and original provider targets until vector cleanup succeeds, including after the source row has been deleted. Reserve indexes before provider writes and reuse recorded chunk IDs during retries.

Keep prepared keyword passages searchable when vector indexing fails. Query vector targets only after activation; every keyword and vector match still requires current source revision and permission evidence.

Save extracted web content through `storeKnowledge` in the current conversation scope and report `storedKnowledge`. The scheduler indexes these native sources; callers cannot select a storage namespace. The previous vector-storage fields and note/document-search fallback are removed.

Store completed repository runs as idempotent repository sources in the scope recorded by Activity. Backfill historical runs from trusted Activity records and quarantine ambiguous ownership instead of copying their former personal-vector scope.

Retire the transferred personal embedding documents from retrieval immediately. Carry their original targets and vector IDs into cleanup receipts, then remove their old D1 records only after confirmed provider deletion. Keep quarantined or unavailable targets as evidence.

Attach knowledge adapters to the existing connector provider registry. Keep root parsing, request scopes, traversal, version validation and upstream permission interpretation in each adapter. Use normalised document records and bounded opaque checkpoints in the shared worker and persistence; discover provider capabilities through the existing connector catalogue and derive the Sources form from them.

Bind each sync to its creator's owned connection through the existing connected-account or stored API-key paths. Keep personal sources private and bind project sources to their workspace membership and publishing authority. Persist a checkpoint after each successful page and prune absent documents only after a complete current scan. Refresh permission evidence independently of content changes; require every current workspace member's email to appear in verified individual grants, or require a public grant. Deny shared retrieval after a new member joins, the publishing admin loses authority, the connection is revoked, the sync is paused or the permission evidence expires.

## Consequences

Historical targets increase retrieval and cleanup cost, and changing credentials can make old targets temporarily unavailable. D1 hydration and explicit lifecycle state cost more than trusting a vector match, but prevent stale or cross-scope results.
