# ADR 0011: Resolve models, tiers and readiness on the server

Status: Implemented.

## Problem

Provider availability, account access and model defaults drifted between clients and execution paths. Automatic routing made this worse: it analysed each prompt with an auxiliary model, then scored every eligible catalogue entry on hand-maintained complexity, reliability, speed and cost fields. The result was unpredictable, drifted as the catalogue grew, spent a model call before every turn, and required fresh scores for every new provider.

Feature-specific output ceilings and hard-coded sampling values separately overrode a model's own defaults without a user decision, and could exhaust a reasoning model's allowance before it returned visible text.

## Decision

Use the API model policy to derive the executable catalogue and resolve automatic defaults. Explicit IDs pass the same access checks. Central auxiliary and capability preferences live in `MODEL_DEFAULTS` and grant no execution authority. Publish account-specific `isExecutable` and `isDefault`, and publish supported service tiers separately from their price multipliers; meter the tier the provider actually reports, which can differ from the request.

Replace prompt scoring with a fixed lineup. A request names a model or a tier (`low`, `medium`, `high`, `ultra`); without either, the project's default tier applies, then Medium. Each tier lists ordered agent and coding candidates as explicit model and provider references with a preferred reasoning effort, and each system task — titling, compaction, housekeeping, reading, guardrails, dictation, documents, media and editor completions — has its own ordered list. Separate lineups cover hosted providers, browser WebLLM and local servers. Resolution walks a list and takes the first entry the account can execute under existing plan, platform and BYOK rules. Attachments remove models that cannot take them, and the candidate's effort becomes the request default only when the model supports it. Comparison mode pairs the primary with the next executable candidate from a different provider and family. Candidates come from published leaderboards and pricing, and the lists are the only place that changes when a better model arrives.

Leave optional output-token and sampling parameters unset unless the caller supplies them. Do not choose generation settings from the feature name, response format or execution mode. Use the catalogue's declared output capacity when a provider protocol requires an explicit maximum, and clamp explicit caller limits only to that capacity. Create saved teammates with automatic sampling and allow an override to be cleared with `temperature: null`. Protocol-required thinking parameters, classifier scoring settings, retrieval budgets and execution bounds are unaffected.

Publish protocol-versioned readiness with `ready`, `setup_required`, `unavailable` and `unknown` states, an actionable reason, and bounded `checkedAt` and `expiresAt` timestamps. Unknown means the check failed; it is not permission to execute, and every invocation still resolves current server-side authority at its I/O boundary. Do not substitute another model when a saved selection disappears or becomes non-executable: retain the selection, explain the account or provider problem, and require an explicit replacement. Provider changes invalidate cached readiness, and expired model readiness is refreshed or blocks submission.

A model selection applies to the next run. Compatible composer attachments and stored conversation history remain available, while model-specific response settings reset. Block a change while a run or its approval or question is active and when current attachments are incompatible; a one-turn image generator requires a new conversation when history already exists. Use a conversation branch for a separately navigable alternative and the existing multi-model response path for an in-place comparison, so each keeps its own model attribution, run identity and usage records.

Build the realtime provider list from registered backend adapters and current account readiness. Keep browser protocol adapters in `library-realtime`; missing protocol support makes a provider unavailable. Revalidate credentials and model access when creating a session. Keep Artificial Analysis ingestion and scoring server-side, cache results in D1, and attribute displayed benchmark data; catalogue prices remain authoritative and benchmark ingestion must not rewrite them.

## Consequences

Model choice is deterministic and visible: the composer and `/models` show what each tier resolves to for the current account, and Free accounts land on the free entries further down the same lists. Removing the prompt analysis call makes every turn cheaper and faster. The lists need periodic curation, and a provider outage is not routed around automatically because access, not availability, decides the fallback. Catalogue scoring fields remain for display but no longer influence selection.

Providers retain their own generation defaults and physical limits, so output may be longer than under the removed caps. Clients gain honest failure and reversal states at the cost of occasionally requiring a refresh or explicit model choice, and readiness never weakens server authorisation. Provider protocol details and current prices belong in code and provider documentation, not copied into this record.
