# Configure Polychat

Use the tracked example files as the only source of truth.

## Configuration sources

- API: `apps/api/.dev.vars.example` and `apps/api/wrangler.jsonc.example`
- Web: `apps/app/src/constants.ts` and `apps/app/wrangler.jsonc`
- API `flagship` binding `FLAGS` (set `app_id` to the Flagship app in the Cloudflare dashboard) lets the dashboard override code-defined flags and experiments; without the binding the rules provider alone decides. `MEMORY_SYNTHESIS_ENABLED` and `TRAINING_QUALITY_SCORING_ENABLED` are now the defaults of the `memory_synthesis` and `training_quality_scoring` flags.
- API `worker_loaders` binding `LOADER` backs the `run_code` tool; without it the tool reports that code execution is unavailable and everything else keeps working.
- Optional worker components: follow each component’s `.dev.vars.example` and `wrangler.json`

## Core requirements

- Keep `APP_BASE_URL`, `API_BASE_URL`, and a strong `JWT_SECRET`.
- Configure matching D1/KV/R2/queue/Durable Object/Analytics bindings for the selected manifest.
- Preserve separate buckets for public vs private assets.
- Configure at least one usable model provider and verify plan/provider access paths.
- Keep `CONVERSATION_COORDINATOR` configured for serialised conversation writes.
- Run required migrations and seed/membership data before sign-in journeys.

## Secrets and callbacks

Use one environment's secrets with the exact callback URLs for auth, webhooks, allowed origins, and email.
Do not duplicate or inline real keys in docs.

## Optional integrations

- **Embeddings:** use `EMBEDDING_SCOPE_SECRET` and keep credentials stable when vectors are populated.
- **Connectors:** configure Composio keying, webhook signature, and callback URLs in the Composio guide.
- **Coding / training workers:** keep API authority, GitHub App tokens, and worker tokens separate.

## Data writes and settings

- Send only changed fields to `/user/settings`.
- Use explicit `null`, `false`, or empty values when clearing settings.
- Use existing project settings only for project scope; personal scope stays separate.

## DynamoDB Vectors

**Provision the table before selecting this provider.** Use an on-demand DynamoDB table with the string partition key `id` and no sort key. Create a vector index with the following definition, and declare `scopeTag` and `type` as string attributes alongside `id` in the table's `AttributeDefinitions`:

```json
{
  "IndexName": "embeddings",
  "VectorAttribute": { "AttributeName": "embedding" },
  "Dimensions": 1024,
  "DistanceFunction": "COSINE",
  "SearchSchema": [
    { "AttributeName": "scopeTag", "SearchSchemaElementType": "HASH" },
    { "AttributeName": "type", "SearchSchemaElementType": "INLINE_FILTER" }
  ],
  "Projection": { "ProjectionType": "ALL" }
}
```

Use the [AWS vector index guide](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/VectorSearch.Creating.html) to create the table or add the index. Wait for `IndexStatus: ACTIVE` and `Backfilling` to stop before using it. The provider validates the schema with `DescribeTable`; it never creates or changes AWS resources.

**Configure personal credentials and settings.** Sync Providers, save the AWS access key ID and secret access key under **DynamoDB Vectors**, then select it in **Embeddings (RAG)** and enter the table, index and region. Apply migration `0056_dynamodb_vectors.sql` before saving settings, and keep the Workers AI binding and stable `EMBEDDING_SCOPE_SECRET` configured.

Grant `dynamodb:DescribeTable`, `dynamodb:PutItem` and `dynamodb:BatchWriteItem` on the selected table, plus `dynamodb:SearchVectors` on its vector index. Use the person's stored credentials; platform AWS credentials cannot substitute for them. Temporary AWS session credentials are not supported by the existing provider credential form.

**Preserve provenance when changing settings.** Documents and built-in memory keep their original table, index, region and credential fingerprint for retrieval and cleanup. Credential rotation blocks historical operations until the original credentials are restored. Existing content stays in its original vector store; changing providers does not migrate it automatically.

Writes use the existing `@cf/baai/bge-large-en-v1.5` model and store opaque lifecycle metadata only. Search always filters by authorised scope, optionally filters by content type, and hydrates content from authorised D1 records. Custom metadata filters are unsupported. Indexing is eventually consistent, so retry later if a newly written item is absent or a newly active index is not yet searchable.
