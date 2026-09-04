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

Import supported reasoning effort levels from models.dev `reasoning_options`. Preserve local defaults and model overrides when synchronising; models.dev does not own those product choices. Keep granular hosted-tool capabilities in the provider catalogue because models.dev exposes only general tool-calling support. models.dev gateway entries (OpenRouter, Vercel, Kilo and similar) disagree with each other and with Anthropic about Claude sampling, so the sync overrides them: any Claude model whose effort levels include `xhigh` is written with `supportsTemperature: false`, `supportsTopP: false`, and `max` in its effort levels, because Anthropic removed temperature, top-p and top-k on Claude Opus 4.7 and later, Claude Sonnet 5 and Claude Fable. The first-party `anthropic` entries on models.dev already agree with this rule.

Forward a configured non-default `reasoning_effort` as a top-level field only through the chat-completion adapters named in the shared parameter mapping's allow list: Azure OpenAI, Cortecs, DeepInfra, GitHub Copilot, GitHub Models, Mistral, Opencode, Opencode Go, OpenRouter, Requesty and Vercel AI Gateway. Every other provider sends nothing, so one that rejects unknown fields cannot start failing because someone changed a setting. Preserve Mistral thinking chunks separately from answer text while streaming and replay the complete thinking chunk in later Mistral turns; dropping it degrades multi-turn reasoning quality.

Bedrock's Anthropic path carries reasoning in Converse `additionalModelRequestFields` and follows the catalogue's `thinkingApi` discriminator. An `adaptive` model takes `thinking: {type: "adaptive"}` with `output_config.effort`, and rejects sampling, so temperature and top-p are dropped from `inferenceConfig`. A `budget` model takes `thinking: {type: "enabled"}` with a `budget_tokens` value held below the request's max tokens. A Bedrock model without the discriminator gets no reasoning payload, which keeps the Anthropic body shape away from the other families Bedrock serves.

## Plan entitlement, usage metering and billing state

Plans are ranked, not compared for equality. `PLAN_RANKS` in `apps/api/src/constants/plans.ts` orders
`free` below `pro` below `enterprise`, and `hasPlanEntitlement` in `apps/api/src/lib/plans.ts` is the only
way to ask whether an account satisfies a requirement. `requirePlan("pro")` therefore admits an enterprise
account. Use the same helper wherever a feature asks "is this person paid" so admission and the surfaces
gated on a paid plan cannot disagree.

Credits are the only allowance. There are no message counts or daily limits, and the deleted daily columns,
multiplier counters and `usage_update` reset task do not return. `user.message_count` survives as a lifetime
counter for product heuristics, never as a limit. Every actor is on credits: a signed-in user through
`usage_balance`, and an anonymous visitor — identified by hashed IP — through the running totals on their
`anonymous_user` row (`credit_period`, `spent_credit_micros`, `reserved_credit_micros`). Default allowances
per period live in `DEFAULT_PLAN_INCLUDED_CREDITS` (anonymous 15, free 150, pro 1500, enterprise 15000), and a
`plans.included_credits` value overrides them. The period is the calendar month and resets at the start of
the next UTC month (`usagePeriodFromDate`, `usagePeriodResetsAt`).

Admission happens once per turn in `ConversationManager.admitTurn`, which reserves the turn's estimated cost
against the balance. `resolveCreditState` moves an actor from `ok` through `reserve` — headroom past the
included allowance so a long turn is not cut off mid-thought — and then to `overage` when overage is enabled
or `exhausted` when it is not. `exhausted` pauses new turns until the period resets or overage is switched
on; work already running finishes, except past the runaway ceiling in `shouldStopRunaway` (included plus
reserve plus an overrun cap), where an in-flight turn does stop.

The vendor-unit ledger is the only cost record. Provider completions call `recordModelTurnUsage`, including
ordinary and agent turns, model-ensemble secondary answers, and every panel turn and conclusion. A
`usage_rollup` task or its inline fallback passes events through
`UsageEventRepository.insertEventAndApplyBalance`, which inserts the idempotent event and conditionally moves
the monthly balance in one D1 batch. Never insert a billable event through another repository method or
derive cost from a message/function multiplier. `/user/usage/balance`, `/user/usage/summary` and
`/user/usage/events` publish the shared credit contract for a signed-in user; an anonymous visitor has no
ledger, only the running total on their row. Model and hosted-tool usage on the person's own provider keys is
priced at their vendor cost but recorded with `billable: false` and zero credits, while infrastructure such
as sandbox runs stays metered and charged. A missing or zero plan allowance is shown as usage without a
denominator rather than as `used / 0` or "unlimited". Web Account and Sidebar share the balance query,
invalidate it after a remote turn, and refresh it at the monthly boundary; the stream payload supplements
rather than replaces that authoritative read. See
[ADR 0041](../architecture/decisions/0041-usage-metering-and-credits.md).

Text-to-speech is reachable without an account, so `apps/api/src/lib/audio/access.ts` gates it. An anonymous
caller may only use the platform-hosted provider and spends the anonymous credit allowance; naming any
paid third-party provider requires an account. Transcription requires an account outright. Signed-in callers
keep the existing plan and provider-key checks in the speech and transcription services.

Stripe webhooks map subscription **status** to entitlement, not just deletion.
`resolvePlanForSubscriptionStatus` treats `active` and `trialing` as entitled and `past_due`, `unpaid`,
`incomplete_expired`, `paused` and `canceled` as revoked; `invoice.payment_failed` revokes and
`invoice.paid` restores. Every handler writes only when the stored state actually changes, so a redelivered
event neither rewrites the row nor sends a second email. An account that outranks `pro` is never downgraded
by a lapsed subscription, because enterprise entitlement is granted outside Stripe. A plan change also
reflects into the current period's `usage_balance`: entitlement columns (`included_credit_micros`,
`grace_credit_micros`, `plan_id`) are set from the plan row — the one legitimate absolute write on the
balance, and it never touches spend columns — and a downgrade to `free` switches `overage_enabled` off.
When a plan has no `grace_credits`, the reserve defaults to 10% of included credits, floored at 50 credits
and capped at 50% of included (`defaultGraceCreditMicros`).

Overage reaches Stripe through Billing Meters, never one event per usage event. An hourly
`stripe_usage_sync` task (queued from the quarter-hour cron on its top-of-hour invocation) compares each
opted-in customer's `overage_credit_micros` against the `stripe_synced_overage_credit_micros` high-water
mark, rounds the pending amount **down** to whole credits, and sends one
`billing.meterEvents.create` per customer with identifier `${customerId}:${hourIso}`. The sub-credit
remainder stays pending for a later hour, so nothing is lost and nothing is double-sent. A duplicate
identifier means an earlier attempt in the same hour already delivered the event, so the amount is marked
synced; any other failure leaves it pending for the next hour. Plans without a `stripe_meter_id` are
skipped with a debug log.

`POST /stripe/overage` opts a user in or out: it requires an entitled subscription and a payment method,
adds or removes the plan's `overage_price_id` as a metered subscription item (idempotently in both
directions), and mirrors the flag onto the current period's balance. `POST /stripe/portal` creates a
billing-portal session. Its `return_url`, and checkout's `success_url`/`cancel_url`, must sit exactly on
the `APP_BASE_URL` origin — anything else is rejected before Stripe is called.

Checkout validates that the selected plan has a non-empty Stripe Price ID before it creates a Stripe
Customer, and it accepts only success and cancellation URLs on the configured app origin. It allows Stripe
promotion codes so an operator can give a named staff customer a 100%-off, forever subscription without
creating a second entitlement path. Follow the
[Stripe billing runbook](../operations/stripe-billing.md); never use a shared unrestricted staff code.

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
