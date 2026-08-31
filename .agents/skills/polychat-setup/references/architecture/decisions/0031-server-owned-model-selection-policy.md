# ADR 0031: Let the server own model selection policy

## Status

Accepted

## Context

Chat, auxiliary work, generated media, realtime sessions, and sandbox runs previously carried model defaults at their call sites. A provider retirement therefore required coordinated edits across API, web, iOS, tests, and Workers, while a stale client could still request the retired model. One global chat default also ignored the models a person's plan and configured providers could actually execute.

The catalogue already describes provider availability, Free-tier access, bring-your-own-key access, router suitability, and deprecation. Those facts need one server-owned policy boundary before execution, while clients need a stable way to present the effective default without copying a model ID.

## Decision

Make the API model policy the authority for executable models and automatic chat selection.

- Treat **visible models** as the catalogue entries the current provider configuration may disclose. Treat **executable models** as the active subset that the account may run: Free users receive Free-tier and personally configured BYOK models, while Pro users receive every visible active model.
- Resolve an automatic chat default from the executable router pool. Prefer the account's standard or Pro routing tier as appropriate, and prefer a configured BYOK provider within that tier. Fail closed when no active chat model is executable.
- Validate every explicitly requested model against the same executable pool. An explicit model ID selects a model; it does not bypass plan, provider, or active-status policy.
- Publish the effective automatic default as `isDefault` and each entry's account-specific execution status as `isExecutable` in the model catalogue. Web and iOS clients repair persisted selections that are no longer executable, consume the default marker, or omit the model and request automatic routing; they do not own fallback model IDs.
- Keep auxiliary, retrieval, guardrail, sandbox, OCR, image, video, music, and speech references in the shared `MODEL_DEFAULTS` policy contract. Account-aware selectors resolve the first active, executable candidate from their ordered lists; capability adapters consume the reference for the provider already authorised by their own boundary. Shared references are selection preferences, never execution authority.
- Require a catalogue test to prove that every policy reference resolves to an active model with the stated provider. Retain deprecated catalogue entries only where migration or historical display requires them; never route, default, feature, or execute them.

## Consequences

A model retirement is handled by updating the catalogue and the central policy references rather than finding client and feature fallbacks across the repository. Free, Pro, and BYOK accounts may receive different defaults, and changing provider configuration can change the effective default without a client release.

Clients remain able to request an explicit accessible model. Automatic callers become simpler, but they depend on the API returning an accurate catalogue and must tolerate the effective default changing between sessions.

Every new model execution path must enter the executable-model policy before provider resolution. Adding a policy reference also requires an active catalogue entry and its validation test; a provider reference cannot make an inactive or unauthorised model executable.
