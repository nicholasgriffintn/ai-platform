# Retrieve documents and built-in memory with DynamoDB Vectors

- **Change:** add DynamoDB Vectors as a personal embedding storage provider.
- **Surfaces:** Providers, Embeddings (RAG), document search and built-in memory.
- **Prerequisites:** apply migration `0056_dynamodb_vectors.sql`; provision the table/index; grant scoped IAM permissions; keep Workers AI and `EMBEDDING_SCOPE_SECRET` configured.
- **Risk if wrong:** writes or searches fail, recent vectors appear after an indexing delay, or historical cleanup remains pending after credential rotation.

## Verify

- [ ] Sync Providers, save DynamoDB Vectors credentials, select it in Embeddings (RAG), save table/index/region and reload settings.
- [ ] Upload a document and save a built-in memory, then retrieve both after indexing. Confirm another account cannot retrieve either.
- [x] Change embedding provider and confirm historical document retrieval and deletion still use the recorded DynamoDB target.
- [x] Rotate credentials and confirm historical retrieval reports unavailability and deletion remains pending. Restore credentials and retry cleanup.
- [ ] Delete a document and memory, then confirm neither is returned even while the vector index catches up.

**Stop and report if:** content crosses account scopes, cleanup reports success after an AWS failure, or requests target the newly selected table instead of the recorded target.

## Automated evidence — 4 October 2026

`apps/api/src/infrastructure/providers/capabilities/embedding` passes (74 tests, 3 files), driving the real `DynamoDbVectorClient`, `DynamoDbVectorStore` and recorded-target parsing with only the outbound AWS HTTP boundary mocked, including request signing and the separate control-plane and search endpoints.

Checked off on this evidence:

- Recorded target: `preserves recorded configuration and cosine compatibility independently of current settings` parses the recorded target back and refuses it when the model, vector space or payload no longer matches its provenance, so historical retrieval and deletion cannot drift onto a newly selected table.
- Credential rotation: `blocks credential rotation before both historical reads and cleanup` rejects a historical read with "credentials changed" and returns a failed deletion with no outbound request at all, and the new `restores historical reads and cleanup once the recorded credentials return` confirms the same client recovers the read and completes the deletion once the recorded credentials come back.

Defect found and fixed: `DynamoDbVectorClient.ensureIndex` memoised its validation promise with `??=`, so a rejected validation was cached for the life of the client and a restored credential could never retry. It now clears the cached promise when validation fails. Without this fix the restore-and-retry check could not pass.

Left open, and why:

- Saving credentials in Providers, selecting DynamoDB Vectors in Embeddings (RAG) and reloading settings is a web journey against a provisioned table.
- Uploading a document and saving a built-in memory, then retrieving both after real indexing, needs the provisioned table and index; cross-scope isolation is proven at the store boundary, where a match carrying another scope tag, a mismatched content type or a malformed score is refused as "Invalid or unscoped".
- Deleting a document and memory is proven at the store boundary — cleanup runs without a ready vector index, batches multiple documents and retains an error for unprocessed deletions — but the application-level delete and the real index catch-up window need the provisioned table.
