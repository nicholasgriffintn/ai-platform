# Retrieve documents and built-in memory with DynamoDB Vectors

- **Change:** add DynamoDB Vectors as a personal embedding storage provider.
- **Surfaces:** Providers, Embeddings (RAG), document search and built-in memory.
- **Prerequisites:** apply migration `0056_dynamodb_vectors.sql`; provision the table/index; grant scoped IAM permissions; keep Workers AI and `EMBEDDING_SCOPE_SECRET` configured.
- **Risk if wrong:** writes or searches fail, recent vectors appear after an indexing delay, or historical cleanup remains pending after credential rotation.

## Verify

- [ ] Sync Providers, save DynamoDB Vectors credentials, select it in Embeddings (RAG), save table/index/region and reload settings.
- [ ] Upload a document and save a built-in memory, then retrieve both after indexing. Confirm another account cannot retrieve either.
- [ ] Change embedding provider and confirm historical document retrieval and deletion still use the recorded DynamoDB target.
- [ ] Rotate credentials and confirm historical retrieval reports unavailability and deletion remains pending. Restore credentials and retry cleanup.
- [ ] Delete a document and memory, then confirm neither is returned even while the vector index catches up.

**Stop and report if:** content crosses account scopes, cleanup reports success after an AWS failure, or requests target the newly selected table instead of the recorded target.
