# ADR 0044: Shape backend systems as primitives packages, starting with providers

Status: Implemented. Providers, functions, agents, tools, workflows, tasks, models, billing and telemetry each live in their own primitives package.

## Problem

The API's provider system had grown a generic core inside a host-specific tree. `lib/providers/library.ts` and `registry/ProviderRegistry.ts` were thin facades over `library-registry`, but they carried Polychat's category list, `IEnv` and `IUser` in their signatures, and an `AssistantError` mapping baked into the registry. `platformProviders.ts`, `utils/apiKeys.ts` and `capabilities/utils.ts` were pure logic that only imported the API for its types. Meanwhile the training Worker resolved its providers with a hand-written `switch`, because the API's library could not be reached without dragging the API along.

[0001](0001-app-and-package-boundaries.md) said to extract runtime code only when a second consumer exists. The training Worker was that consumer, and the same will be true of each backend system in turn: registries, credential resolution, fallback and the like are repeated wherever a Worker talks to a vendor.

## Decision

Backend systems are shaped as small primitives packages with one focused API each, in the style of the `primitives.org.ai` collection: a package owns one mechanism, is generic over the host's types, throws its own coded error, and lets the host map that error and decorate what it produces. Providers go first.

`@ngriffin_uk/polychat-ai-providers` owns:

- `ProviderLibrary` and `ProviderRegistry`, generic over a category-to-instance map and a factory context. Bootstrappers run once per category on first touch and each bootstrapper runs at most once, so a later `registerBootstrapper` extends a category rather than re-registering it. `decorate` wraps every resolved instance; `mapError` converts each `ProviderError` into the host's own error type.
- `PROVIDER_PLATFORM_ENV_KEYS` and the platform credential predicates.
- `resolveProviderApiKey` and `hasUserProviderApiKey`, reading a user's stored key through a host-supplied `ProviderKeyStore` and falling back to the platform key unless BYOK authority forbids it.
- `generateWithProviderFallback`.

The package also owns the vendor implementations for every category. Each provider receives a `ProviderRuntime`, which is the host's `ProviderHost` (model resolution, storage, key store, metrics, realtime grants) plus a resolver for sibling providers, so a provider never imports a host module. The API keeps what is Polychat's: the `ProviderHost` implementation in `lib/providers/host.ts`, the sandbox and SageMaker registrations it alone serves, and the chat decorator that applies tool policy. `fromProviderError` in `utils/errors` is the single mapping from package codes to `AssistantError`, applied by the library's `mapError`, by the API key adapter, and by `normaliseApiError` for anything that escapes. `credential_required` stays a 403 authorisation error; every other code is a configuration error.

The training Worker registers its Bedrock and SageMaker providers through the same `ProviderLibrary`, with `transient` lifecycle because each instance captures the request's environment.

## Consequences

Provider mechanics are tested once, in the package, against plain types; the API's tests cover only its adapters and error mapping. The library's category accessors (`providerLibrary.chat(...)`) are replaced by `resolve("chat", ...)`, since a generic library cannot grow a method per host category. Bootstrappers that were re-run wholesale by `registerBootstrapper` no longer raise duplicate registrations.

The same shape now covers the rest of the backend. Naming is fixed: `ai-*` packages are the top-level interaction primitives a host calls, `library-*` packages are the mechanisms they compose, and `utility-*` packages are dependency-light helpers.

- `ai-functions` gives task-shaped calls (`generateText`, `generateObject`, `classify`, `extract`, media, retrieval) over a `ProviderRuntime`.
- `ai-agents` owns context management (context budgets, compaction plans, window limits) and builds `Agent` on `library-agent-loop` (the decision loop, renamed from `agent-core`) and `library-tools` (definitions, catalogues, validation, execution, replacing `library-tool-runtime` and the tool registry schema).
- `library-tasks` holds outcome settlement, execution leases, handler registries, polling and cron schedules, and status machines. `ai-workflows` composes them into `on` (validated queued tasks), `poll` (self-rescheduling pollers with an attempt cap) and `every`/`always` (cron jobs); the API registers every task and cron job in `services/tasks/registry.ts` and `schedules.ts` and feeds `handlers()` and `runCron()` to its queue and scheduled entry points. An earlier `library-workflows` (in-process step runner, event bus, KPI workers) had no consumer and was removed.
- `ai-models` owns model lookup and policy over `library-model-catalogue`, which owns the models.dev data, schema and sync script. The API no longer carries a model table.
- `ai-billing` owns turn estimates, credit state, rate-card pricing, provider billable units, entitlement, price drift, and the usage engine: ledger rows and rollups, credit admission, reservations, plan allowances, infrastructure and capability metering. The API implements `UsageStore` over its repositories and supplies queue delivery and sync notifications through `UsageRuntime`.
- `ai-telemetry` owns the logger, the `Telemetry` facade and its sinks (Analytics Engine, PostHog, beacon, OTLP), the metrics recorder, AI generation and training-example capture, and token usage helpers; `ai-providers` composes them into `createProviderMetrics` for the host `ProviderHost.metrics`. Loggers come from here so records can reach sinks.

Inside the API the rule is now: `apps/api/src/lib` holds only host infrastructure (database, http, storage, Cloudflare and Durable Object clients, the provider host, telemetry wiring), and every product capability lives under `services/<capability>` (`chat`, `conversations`, `usage`, `models`, `memory`, `realtime`, `subscription`, and so on) with its orchestration, policies and store adapters together.

Each package throws its own coded error (`ProviderError`, `ToolError`, `TaskError`), and `apps/api/src/utils/errors.ts` is the single site that maps them to `AssistantError`. Module size still does not justify a package on its own; a repeated mechanism across Workers does.
