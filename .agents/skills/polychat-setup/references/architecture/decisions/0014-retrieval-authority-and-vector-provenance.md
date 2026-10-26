# ADR 0014: Run knowledge through one layer with authority in D1

Status: Implemented.

## Problem

Vector providers are retrieval accelerators. Treating them as access-control or document-lifecycle authorities would let a stale or cross-scope match return content the caller cannot see.

Knowledge also arrived by many doors. Uploads, connector syncs, feeds, Mac activity, evidence, generated media and notes each wrote sources their own way, enriched them their own way and stored whole bodies in D1. Each new capability had to be wired into every one of them.

## Decision

The knowledge module owns intake, enrichment, indexing, query and federation. Every source is filed through `commitKnowledgeDocument`, which resolves personal, notebook or project authority once, records an origin and upstream identity, and protects pipeline metadata from callers. Only the knowledge module may import its infrastructure, so the commit is the only source insert. External memory providers keep their own local memory records. Public pages are named by scope and canonical URL, so each is filed once per library or project. Connector documents stay bound to the sync that read them, because their visibility follows that sync's account and grants. A connector sync either follows a catalogued descriptor, which files one document per upstream item with revision skips, incremental windows and tombstones, or a hand-written mapping that files one document.

Bodies over the inline limit live in private R2 under a key derived from the source, with a preview and a pointer in D1. Readers that need the whole text go through the knowledge body reader, which refuses pointers that do not belong to the source.

Enrichment is a registry of versioned enrichers. Each records its status against the content hash and reruns only when the content or its version changes. Topics and entities are source collections and document relations are resource links, so facets reuse collection filters. Sources, finished outputs and memory documents share one index. Memory is kept as whole documents: the memory service owns their writes and recalls passages from the shared index, and the one-line vector memory store is gone. Personal files and memories are indexed in the vector store the person chose, and project material in Polychat's. Federated knowledge bases are searched through the person's own connection, or a project attachment made by an owner or admin who holds the connection, and their hits are reranked with local ones but never stored unless filed. Cedar decides settings changes, attachments and whether a document may enter retrieval: a document kept out of answers never does, and a confidential one never reaches a teammate.

Keep embedding generation and vector storage as separate API-owned capabilities. Persist the exact provider target, credential fingerprint and vector-space compatibility fields with each document and chunk. Model, dimensions, metric or task-mode changes require a new compatible vector space and re-embedding.

Use model-driven `search_documents` rather than request-level retrieval controls, and keep private document research separate from external paid web research.

Hydrate provider matches through authorised active D1 records before returning content. Never return raw provider metadata, private targets or credential fingerprints. Query historical targets with bounded fan-out and reciprocal-rank fusion; preserve partial-failure reporting and refuse unsupported target counts.

Treat reranking as a provider primitive, not as document-search internals. The `reranking` provider category accepts bounded opaque document IDs and text and returns the same IDs with relevance scores. `ai-functions` maps those scores back onto caller-owned typed documents. The API resolves an accessible reranking model centrally, hydrates and authorises D1 records before passing them to the reranker, applies reranking before `top_k`, and preserves the authorised baseline order when the optional capability is unavailable or fails. Provider scores never grant retrieval authority.

Personal indexes support Vectorize, S3 Vectors and DynamoDB Vectors. Derive scope from authentication with the stable `EMBEDDING_SCOPE_SECRET`; clients cannot choose namespaces or provider provenance. S3 Vectors and DynamoDB Vectors use the person's stored credentials, never platform AWS credentials for a user-selected target, and credential rotation must not redirect historical cleanup.

Reserve documents as `pending`, expose only `active` records, and mark `delete_pending` before provider deletion. Remove D1 state only after confirmed cleanup and retain uncertain writes for reconciliation against their original target. Quarantine ambiguous legacy ownership rather than guessing. Enforce content, metadata, batch and concurrency bounds at the shared schema and provider boundaries. Keep project memory in its authorised built-in scope.

## Consequences

Historical targets increase retrieval and cleanup cost, and changing credentials can make old targets temporarily unavailable. D1 hydration and explicit lifecycle state cost more than trusting a vector match, but prevent stale or cross-scope results. Item-level syncs and enrichment multiply rows and model calls, so enrichers are per-scope settings and bodies leave D1, while chunks stay in D1 for full-text search.
