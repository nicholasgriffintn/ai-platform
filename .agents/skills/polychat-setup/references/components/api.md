# API Worker

OpenAI-compatible API with 40+ models, built on Cloudflare Workers.

## Overview

The API provides a unified interface to multiple AI providers, following OpenAI's API conventions while extending functionality with agents, RAG, guardrails, and specialized code generation endpoints.

**Base URL:** `https://api.polychat.app`

## Key Features

- **OpenAI-Compatible** - Drop-in replacement for OpenAI API
- **40+ AI Models** - Anthropic, OpenAI, Google, Mistral, Meta, and more
- **Code Specialized** - FIM completions, edit suggestions, code application
- **AI Agents** - Custom agents with MCP server integrations
- **Skills** - Specialised instructions the model loads on demand instead of carrying in every prompt
- **RAG & Memories** - Vector-based context with Cloudflare Vectorize
- **Training Control Plane** - A training and fine-tuning execution service
- **Content Safety** - LlamaGuard, Mistral Moderation, self-hosted Shieldstral, and AWS Bedrock Guardrails
- **Flexible Auth** - OAuth, API keys, JWT, magic links, passkeys
- **Real-time** - Streaming responses and WebSocket support
- **Durable goal history** - Goal lifecycle markers remain in stored conversation timelines while
  staying out of model context

Use the skill's [local setup](../setup.md), [configuration](../configuration.md), and [deployment](../deployment.md) workflows rather than maintaining component-specific setup steps here.

Document research is a loadable skill over the read-only `search_documents` tool. It teaches the shared agent loop to refine searches and reconcile evidence from authorised personal or project material. Keep it separate from the `research` tool, which delegates paid deep-web research to an external provider; private document passages must not cross into that provider.

The local API uses `http://localhost:8787` by default. The chat completion route is `/chat/completions`; use the generated OpenAPI reference for the current request contract.

Automatic routing modes prefer their matching model tier. If that tier has no model which is both accessible to the person and suitable for the prompt's capabilities, route through the broader accessible automatic pool instead of failing the turn.

The server owns model selection policy. Provider configuration determines the visible catalogue, then active status and Free, Pro, or BYOK entitlement determine the executable subset. `/models` marks every entry with account-specific `isExecutable` and the effective automatic chat choice with `isDefault`. Clients must repair a persisted selection when `isExecutable` is false. Omitted models with `model_router_mode: auto` use the same policy, while explicit model requests are rejected unless the account may execute them. Central auxiliary and capability references must resolve to active catalogue models and do not bypass these checks.

When a chat request omits its output-token limit, resolve a workload-aware default before calling the provider: 2,048 for structured JSON, 8,192 for ordinary chat, 16,384 for agent or coding work, and 32,768 for reasoning models. An explicit `max_tokens`, `max_completion_tokens`, or `max_output_tokens` value overrides that default and is clamped only to the selected model's catalogue limit.

For OpenAI text models, keep Polychat's public route independent of the upstream transport. Route models that require Responses, requests for supported OpenAI-hosted tools, and function-tool requests with a non-`none` reasoning effort through `/v1/responses`; use Chat Completions for compatible requests. Model capability metadata is the authority for which hosted tools, reasoning levels, and upstream streaming modes the UI may offer.

Import supported reasoning effort levels from models.dev `reasoning_options`. Preserve local defaults and model overrides when synchronising; models.dev does not own those product choices. Keep granular hosted-tool capabilities in the provider catalogue because models.dev exposes only general tool-calling support.

Forward a configured non-default `reasoning_effort` as a top-level field only through the chat-completion adapters named in the shared parameter mapping's allow list: Azure OpenAI, Cortecs, DeepInfra, GitHub Copilot, GitHub Models, Mistral, Opencode, Opencode Go, OpenRouter, Requesty and Vercel AI Gateway. Every other provider sends nothing, so one that rejects unknown fields cannot start failing because someone changed a setting. Preserve Mistral thinking chunks separately from answer text while streaming and replay the complete thinking chunk in later Mistral turns; dropping it degrades multi-turn reasoning quality.

Bedrock's Anthropic path carries reasoning in Converse `additionalModelRequestFields` and follows the catalogue's `thinkingApi` discriminator. An `adaptive` model takes `thinking: {type: "adaptive"}` with `output_config.effort`, and rejects sampling, so temperature and top-p are dropped from `inferenceConfig`. A `budget` model takes `thinking: {type: "enabled"}` with a `budget_tokens` value held below the request's max tokens. A Bedrock model without the discriminator gets no reasoning payload, which keeps the Anthropic body shape away from the other families Bedrock serves.

## Plan entitlement, usage counters and billing state

Plans are ranked, not compared for equality. `PLAN_RANKS` in `apps/api/src/constants/plans.ts` orders
`free` below `pro` below `enterprise`, and `hasPlanEntitlement` in `apps/api/src/lib/plans.ts` is the only
way to ask whether an account satisfies a requirement. `requirePlan("pro")` therefore admits an enterprise
account. Use the same helper wherever a feature asks "is this person paid" so the check that admits a turn
and the increment that bills it cannot disagree.

Daily usage counters are written with relative SQL. `UserRepository.incrementUsageCounters` and
`AnonymousUserRepository.incrementDailyCount` each apply a single `SET column = column + ?` statement whose
`CASE` restarts the counter when the stored reset stamp is not today's UTC day. Never read a counter, add to
it, and write the total back: concurrent requests all read the same value and a limit stops holding.

Text-to-speech is reachable without an account, so `apps/api/src/lib/audio/access.ts` gates it. An anonymous
caller may only use the platform-hosted provider and spends the anonymous daily message allowance; naming any
paid third-party provider requires an account. Transcription requires an account outright. Signed-in callers
keep the existing plan and provider-key checks in the speech and transcription services.

Stripe webhooks map subscription **status** to entitlement, not just deletion.
`resolvePlanForSubscriptionStatus` treats `active` and `trialing` as entitled and `past_due`, `unpaid`,
`incomplete_expired`, `paused` and `canceled` as revoked; `invoice.payment_failed` revokes and
`invoice.paid` restores. Every handler writes only when the stored state actually changes, so a redelivered
event neither rewrites the row nor sends a second email. An account that outranks `pro` is never downgraded
by a lapsed subscription, because enterprise entitlement is granted outside Stripe.

## Embedding API safety and lifecycle

The authenticated `/apps/embeddings` API is personal-only. Derive the person from
`ServiceContext` and use a versioned, opaque HMAC scope tag generated from the stable
`EMBEDDING_SCOPE_SECRET`; never accept a user ID, namespace, provider target, vector-space
identifier, or provider metadata from the request. Reject project retrieval through this API until
project-scoped storage and server-side membership authorisation exist.

Apply these limits at the public schema boundary:

| Input                        | Limit                                                                    |
| ---------------------------- | ------------------------------------------------------------------------ |
| Document content             | Non-empty and no more than 256 KiB when UTF-8 encoded                    |
| Document title               | 200 characters                                                           |
| Document type                | 1–64 safe identifier characters                                          |
| Optional logical document ID | 1–128 safe identifier characters                                         |
| Query                        | 1–1,000 characters                                                       |
| Delete request               | 1–100 unique logical document IDs                                        |
| User metadata                | 8 KiB of JSON, four levels deep, at most 64 keys and 128 items per array |

Metadata keys must use the supported identifier shape and must not collide with internal scope,
document, chunk, lifecycle, provider, or vector-space fields. Reject unknown request fields so a
caller cannot restore the former client-selected namespace or file-payload behaviour.

D1 is authoritative for embedding documents, their chunks, user-visible metadata, lifecycle,
and provider provenance. Treat provider indexes as retrieval accelerators rather than an
authorisation or public-metadata source. A query may use provider scores to rank candidates, but
return a candidate only after its vector ID hydrates to an active D1 chunk owned by the
authenticated person. Never return provider metadata or a vector match that D1 cannot authorise.

Keep document and chunk lifecycle changes explicit:

- `pending` records reserve the logical ID before provider writes. They are not queryable. Remove
  them only when no provider write occurred or compensation is confirmed; retain uncertain writes
  for reconciliation. Before retrying a retained logical ID, delete its vectors from the exact
  stored target and release the pending record only after that deletion succeeds.
- `active` records are the only records eligible for retrieval.
- `delete_pending` records become unqueryable before provider deletion. Delete D1 records only
  after the stored provider confirms deletion; otherwise retain the state so the same logical IDs
  can be retried safely.

Capture the provider and vector-space target when a document is created and treat that provenance
as immutable. Changing a person's current provider setting must not redirect deletion,
compensation, or reconciliation for an existing document. Query every distinct active stored
target for that person with bounded concurrency, then merge and hydrate the results through D1.
Search at most eight historical targets, continue when one target is unavailable, and use
reciprocal-rank fusion when combining rankings whose provider scores are not directly comparable.
Fail the search when no stored target is reachable, and require target consolidation before
searching more than eight targets. Apply the same immutable-target, partial-failure, target-limit,
ranking, and post-query D1 hydration rules to built-in memories.

Support the managed lifecycle only for Vectorize and S3 Vectors. Fail closed when Bedrock or an
unknown provider is selected instead of writing data that the lifecycle cannot subsequently
delete. An authenticated person using S3 Vectors must supply their own stored S3 credential;
never fall back to platform AWS credentials for a person-selected bucket, index, or region.
Fingerprint the validated credential into immutable target provenance. A credential rotation must
fail closed for historical targets until the old credential is restored or an operator safely
reconciles and reindexes them; never redirect an existing target to the replacement credential.

Bound provider work to protect both the API and upstream services. Generate embeddings with at
most eight concurrent model calls, and delete provider vectors in pages of at most 500. Insert a
maximum-sized document into D1 as one document statement and one set-based chunk statement so the
transaction stays within D1's statement limits.

Treat content extraction as a write operation. Require write permission, store at most ten
extracted results per request, and compensate for earlier provider writes if a later result fails
so partial content does not become queryable.

Keep media video-search enrichment disabled in both schema-backed clients and the service. Reject
`enableVideoSearch: true` with a clear `501` response until a supported multimodal retrieval path
exists.

Apply the same lifecycle discipline to built-in memory. Create its source as `processing`, expose
only an `available` source after the provider write succeeds, and mark it `archived` before
provider deletion. Retain non-available source state when provider outcomes are uncertain so the
operation can be reconciled or retried safely. Treat lifecycle status, content, and embedding
target metadata as service-managed fields: reject public updates to them, and never expose the
stored target in public source metadata.

Quarantine ambiguous legacy data rather than guessing authority. Backfill only rows whose stored
user ID agrees with their exact `user_kb_<user-id>` namespace. Group a legacy chunk with a parent
only when its canonical non-negative `chunkIndex`, matching ID suffix, parent row, user, and
namespace all agree; leave every other unscoped or ambiguous row outside the public query and
provider-delete paths. Allow an authorised retry or delete to release quarantined D1 records
without guessing an external provider target. Archive targetless legacy memories and retain their
local record rather than searching or deleting through the person's current provider.

## Runtime infrastructure

The API runs on Cloudflare's global network with:

- D1 for database
- Vectorize for embeddings
- R2 for media storage
- Analytics Engine for metrics
- Service bindings for sandbox and training Workers

## Architecture

- **Framework:** Hono (lightweight HTTP framework)
- **Database:** D1 + Drizzle ORM
- **Validation:** Zod schemas
- **OpenAPI:** Auto-generated docs via hono-openapi
- **Auth:** Multiple providers (OAuth, JWT, API keys, WebAuthn)
- **Storage:** R2 for media, Vectorize for embeddings
- **Training:** API model catalog plus `TRAINING_WORKER` service binding and shared `TRAINING_WORKER_TOKEN` for provider job execution

Repository development rules remain in the root `AGENTS.md`. The workspace uses TypeScript, Vitest, oxfmt, and oxlint.

Batch transcription is an authenticated file-upload boundary. It validates the actual file size,
declared audio MIME type, and container signature before provider execution, does not accept remote
URLs, and returns `Cache-Control: private, no-store`. Authenticated Notes workflows resolve private
Source and Output media through the storage authorisation seam. Provider-side remote URL ingestion,
including video-analysis URLs, is disabled because Polychat cannot enforce the provider's egress
destination after DNS resolution.
