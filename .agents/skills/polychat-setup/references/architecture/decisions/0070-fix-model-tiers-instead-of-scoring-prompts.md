# ADR 0070: Fix model tiers instead of scoring prompts

Status: Implemented.

## Problem

Automatic routing analysed each prompt with an auxiliary model, then scored every eligible catalogue entry on hand-maintained complexity, reliability, speed and cost fields. The result was hard to predict, drifted as the catalogue grew, and spent a model call before every turn. People could not tell which model a mode would produce, and every new provider needed fresh scores before the router would consider it.

## Decision

Replace prompt scoring with a fixed lineup. A request names a model or a tier (`low`, `medium`, `high`, `ultra`); without either, the project's default tier applies, then Medium. Each tier lists ordered agent and coding candidates as explicit model and provider references with a preferred reasoning effort, and each system task (titling, compaction, housekeeping, reading, guardrails, dictation, documents, media and editor completions) has its own ordered list. Separate lineups cover hosted providers, WebLLM in the browser and local servers such as Ollama and LM Studio.

Resolution walks a list and takes the first entry the account can execute under existing plan, platform and BYOK rules. Attachments remove models that cannot take them, and the candidate's effort becomes the request default only when the model supports it. Comparison mode pairs the primary with the next executable candidate from a different provider and family. Candidates are chosen from published leaderboards and pricing rather than internal scores, and the lists are the only place that changes when a better model arrives.

## Consequences

Model choice is deterministic and visible: the composer and `/models` show what each tier resolves to for the current account, and Free accounts land on the free entries further down the same lists. Removing a prompt analysis call makes every turn cheaper and faster. Project defaults now express a tier rather than a scoring mode, and the stored project column, request field and iOS request were changed in step.

The lists need periodic curation, and a provider outage is not routed around automatically because access, not availability, decides the fallback. Catalogue scoring fields remain for display but no longer influence selection.
