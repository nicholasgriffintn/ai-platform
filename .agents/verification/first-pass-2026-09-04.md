# Verification first pass — 4 September 2026

This is the hand-off index for `.agents/verification/pending/`. A checked step is backed by deterministic local evidence in the release Playwright suite or a named narrow check in that item. Unchecked steps are intentionally left for a person because they depend on deployed state, real provider behaviour, migrated data, hardware, assistive technology, timing or qualitative judgement.

The local release suite runs the built web app against the real bundled API Worker and local D1. It doubles only outbound third-party boundaries. It does not claim to prove production migrations, secrets, provider accounts, Stripe webhooks, live audio/video, iOS device behaviour or deployed response headers.

<!-- prettier-ignore -->
| Verification item | Confirmed locally | Manual hand-off |
| --- | ---: | --- |
| `2026-08-31-00-deploy-prerequisites.md` | 1/10 | Approve destructive/backfill semantics, take a backup, configure secrets/bindings, migrate, deploy and ship iOS. |
| `2026-08-31-accessibility-pass.md` | 3/6 | Check VoiceOver announcements, long-running progress and focus stability during a live stream. |
| `2026-08-31-agents-contract-and-composition.md` | 0/8 | Inspect migrated agents and credentials; run tools, skills and shared project agents; exercise dependency-protected deletion. Personal agent CRUD has baseline E2E coverage. |
| `2026-08-31-authored-skill-revisions.md` | 3/8 | Inventory and republish legacy R2 skills, then judge UI/runtime loading and recorded revision attribution. |
| `2026-08-31-capability-library-add-menu.md` | 2/4 | Create every offered capability through both scoped menus and judge the permission-dependent choices. |
| `2026-08-31-document-research-skill.md` | 0/4 | Use a real indexed corpus and judge citation accuracy, research quality and the no-document response. |
| `2026-08-31-embedding-lifecycle.md` | 0/7 | Inspect the production backfill, stable secret, legacy corpus, indexing and cross-account/project isolation. |
| `2026-08-31-ios-app-build.md` | 0/7 | Exercise the shipped and new builds on a device, including background recovery, tools and settings. |
| `2026-08-31-model-catalogue-updates.md` | 0/4 | Visually scan icons and exercise the upstream models, Mistral OCR and realtime catalogue with live keys. |
| `2026-08-31-model-selection-policy.md` | 0/6 | Exercise configured/unconfigured provider routing, BYOK, media, realtime and sandbox selection. Free/Pro text journeys have baseline E2E coverage. |
| `2026-08-31-ocr-upgrade.md` | 0/8 | Use real public/private documents, Mistral, project scope, limits, batches, downloads and deletion. |
| `2026-08-31-pets-by-model-maker.md` | 4/5 | Confirm migrated pre-release assignments still resolve as intended. |
| `2026-08-31-post-release-cleanup.md` | 2/18 | Review labels and exercise discovery, concurrent turns, approvals, async media, compaction, sandbox and realtime against live services. |
| `2026-08-31-realtime-sessions.md` | 0/6 | Use a microphone and live OpenAI/Gemini sessions; interrupt and close them; inspect coordinator logs. Muted-session cleanup has baseline E2E coverage. |
| `2026-08-31-reasoning-and-sampling-defaults.md` | 0/6 | Exercise Claude generations and each real gateway, especially Bedrock thinking and provider sampling validation. |
| `2026-08-31-security-headers-and-sanitised-markup.md` | 0/7 | Inspect the deployed CSP, console and rich renderers; exercise sandbox/training auth and a live merge mismatch. Local document/asset/callback headers are covered by E2E. |
| `2026-08-31-server-managed-tool-selection.md` | 0/6 | Judge automatic discovery and multi-tool ordering, verify explicit API lists and repeat on iOS. Hosted-tool submission has baseline E2E coverage. |
| `2026-08-31-shieldstral-guardrails.md` | 0/6 | Audit stored production values and exercise configured/unconfigured live guardrail providers and reversal. |
| `2026-08-31-team-agents-retired.md` | 3/7 | Preserve the pre-migration team inventory, confirm agent survival, rebuild required flows and clear legacy stage permissions. |
| `2026-08-31-turn-reliability-and-performance.md` | 2/10 | E2E covers switching away and full browser restart during a stream, including partial restoration and final reconciliation. Stress long streams, stop/reload behaviour, atomic replacement, large history, compaction and concurrent turns remain for manual review. |
| `2026-08-31-usage-enforcement-and-billing-state.md` | 6/15 | Exercise enterprise rank, Stripe lifecycle/idempotency, Analytics Engine queries and price-drift logs. Anonymous concurrency and audio boundaries are locally covered. |
| `2026-08-31-usage-metering-ledger.md` | 4/13 | Inspect the migration, prompt caching, ensembles/panels, failed-batch idempotency, monthly live refresh, iOS decoding and real-rate scale. |
| `2026-09-01-billing-and-pricing-surfaces.md` | 3/7 | Exercise unavailable/configured Stripe controls, dismiss/reload banner behaviour and signed-in pricing CTA state. |
| `2026-09-01-credit-enforcement-soft-reserve.md` | 5/10 | Stress a long agent over the boundary, runaway stopping, real BYOK and realtime reconciliation. |
| `2026-09-01-credits-replace-message-limits.md` | 8/8 | No manual gap remains in this item. |
| `2026-09-01-infrastructure-and-capability-metering.md` | 0/12 | Deploy API/sandbox together and inspect real container, capability, realtime and Analytics API accounting. |
| `2026-09-01-ios-usage-adoption.md` | 0/1 | This is a future iOS adoption decision, not current executable behaviour. |
| `2026-09-01-provider-billable-signals.md` | 0/8 | Exercise each named live provider signal, cache/search pricing and BYOK hosted-tool accounting. |
| `2026-09-01-stripe-checkout-and-staff-access.md` | 1/6 | Exercise missing configuration, real test Checkout, webhook delay, promotion codes and cancellation. The local Stripe boundary covers redirect validation and configured session construction. |
| `2026-09-01-stripe-metered-overage.md` | 1/9 | Inspect the migration and real Stripe plan, payment method, meter sync idempotency and cancellation webhook. |
| `2026-09-02-account-tasks-hide-credit-accounting.md` | 2/4 | Trigger a real memory synthesis and inspect internal roll-up task persistence. |
| `2026-09-02-connector-oauth-popup-completion.md` | 2/7 | Exercise real cross-site consent, manual close/wait states and deployed callback headers. The popup message path is covered against the Composio boundary double. |
| `2026-09-02-new-conversation-appears-in-sidebar.md` | 3/4 | Stress several near-simultaneous creations during a cold history load. Warm-cache insertion/refetch behaviour is covered. |
| `2026-09-04-branch-picker.md` | 1/3 | E2E covers the hidden unbranched state without a branches request, then creates a branch and navigates the family. Confirm picker reset and responsive visual alignment manually. |
| `2026-09-04-conversation-branches.md` | 3/5 | Exercise cross-member Work branches and the visible Retry state for a failed branch request. |
| `2026-09-04-fast-mode-selector.md` | 5/7 | Repeat Fast and Automatic in the iOS settings sheet, then exercise the real Astra EU-residency refusal. Web Chat/Work and the provider request, response-tier extraction and pricing boundaries are covered locally. |
| `2026-09-04-openai-astra-model-support.md` | 0/7 | Exercise Astra in Work and the advanced Responses/function/cache/long-context contracts with an enabled live OpenAI account. Local Chat covers multimodal streaming, low/max effort, selector bounds and unsupported field omission. |
| `2026-09-04-project-routing-preference.md` | 5/7 | Inspect the selected model and resume behaviour for saved Lite and ordinary Auto pools. Persistence, explicit overrides, templates, authorisation and personal isolation are covered. |
| `2026-09-04-tool-result-compaction.md` | 2/2 | No manual gap remains in this item; provider projection, stored history and edge cases are covered by the API integration suite. |
| `2026-09-04-workspace-usage.md` | 5/6 | Remove an administrator after they load Governance, then refresh and confirm cached spend disappears. |

## Review rule

Do not treat an unchecked box as a failed local test. Treat it as the remaining operator action described above, and stop on the condition recorded in its source item. If a manual check exposes a reproducible local defect, add the smallest deterministic regression journey before fixing it.
