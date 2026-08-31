# Embeddings are scoped, provenance-tagged, and quarantined when unknown

- **Change:** The embedding provider contract is split into generating vectors, storing and querying caller-owned vectors, and querying a provider-managed knowledge base. Stored records now carry dimensions, distance metric, and task mode. Personal scope tags are derived from `EMBEDDING_SCOPE_SECRET`. Legacy rows whose user and namespace do not independently agree are quarantined rather than falling back, and the stale `use_rag` and `rag_options` request controls are gone — document retrieval runs through the `search_documents` tool.
- **Surfaces:** web, iOS, API
- **Prerequisites:** `EMBEDDING_SCOPE_SECRET`, and migrations `0008`, `0009` (backfill), `0010`.
- **Risk if wrong:** documents a person uploaded stop being findable, or worse, become findable to the wrong person. Both are quiet.
- **Commits:** `8c9fa093` (#2167), `1038665e` (#2177). See ADR 0033.

## Verify

- [ ] Before applying `0009` to production, count the embedding rows and the rows the backfill will leave unquarantined. Decide whether the difference is acceptable.
- [ ] After deploying, ask a chat about a document you uploaded before this release. Confirm `search_documents` finds it.
- [ ] Upload a new document, wait for indexing, and confirm it is retrievable in the scope you uploaded it to.
- [ ] Sign in as a different account and ask for content from someone else's document. Confirm nothing leaks.
- [ ] Repeat both checks inside a project, and confirm project sources stay inside the project.
- [ ] Confirm chat requests no longer carry `use_rag` or `rag_options`, and that neither web nor iOS shows a retrieval toggle that does nothing.
- [ ] Spot-check a quarantined legacy document and confirm it fails closed — no results — rather than returning something mismatched.

**Stop and report if:** documents from before the release are not retrievable at all, or any retrieval returns content from another account. Do not rotate `EMBEDDING_SCOPE_SECRET` to try to fix it; that invalidates every derived tag.
