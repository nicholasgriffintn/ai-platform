# ADR 0033: Separate embedding runtime and retrieval policy

## Status

Accepted

## Context

The embedding provider contract combined three different capabilities: generating vectors, storing and querying caller-owned vectors, and querying a provider-managed knowledge base. That shape made a provider appear interchangeable even when it owned only one part of the lifecycle. Stored records also lacked dimensions, distance metric, and query/document task mode, so changing a model could silently mix incompatible vectors in one index.

Chat requests separately carried `use_rag` and `rag_options`, but the shared turn engine did not consume them. Document retrieval already runs through the model-called `search_documents` tool. Keeping the stale request controls presented a second, non-functional retrieval policy to web and iOS clients.

## Decision

- Keep the embedding runtime in `apps/api`. There is no second repository consumer that justifies a shared package.
- Model caller-owned retrieval as an `Embedder` paired with a `VectorStore`. Keep provider-managed knowledge bases on the transitional provider seam until a real caller justifies a separate contract; do not manufacture vector generation or lifecycle semantics they do not expose.
- Retain a narrow adapter around combined Phase 1 providers while callers migrate to the capability-specific interfaces.
- Identify a vector runtime with the embedding transport, private provider target, model, dimensions, distance metric, task mode, vector space, and vector-space version. Persist that compatibility provenance on every document and chunk. Use an explicit `provider-configured` metric only while the bound index cannot report its configured metric; a change to any compatibility field creates a new vector space and requires re-embedding.
- Keep D1 as retrieval authority. Provider matches contribute vector IDs and scores only; the repository supplies scoped content, metadata, lifecycle state, chunk identity, and provenance.
- Return a stable document ID plus chunk ID and index, the ranking method, and safe model provenance. Never expose provider targets, bucket or index names, credential fingerprints, or internal vector-space names.
- Keep retrieval model-driven through `search_documents`. Remove `use_rag` and `rag_options` from current clients and the parsed request contract instead of restoring automatic context injection. The request boundary accepts and discards both retired fields during the rolling-deployment compatibility window.

## Consequences

Provider adapters become more explicit and new embedders can reuse Vectorize or S3 Vectors without pretending to own storage. Managed knowledge bases remain on the transitional provider seam until their existing callers migrate, avoiding an unused abstraction in this phase.

Model upgrades now require a new vector-space version and a re-indexing path. Mixed historical targets can still be queried with bounded fan-out and reciprocal-rank fusion, but their scores are labelled rather than presented as directly comparable provider scores.

Existing Phase 1 Workers AI records are backfilled with their known dimensions and task mode. Quarantined legacy records retain unknown provenance and cannot be queried until they are re-indexed.
