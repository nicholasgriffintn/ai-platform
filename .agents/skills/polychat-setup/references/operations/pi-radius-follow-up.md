# Track the Pi and Radius follow-up

The first implementation covered only project routing preferences. Review the additional PRs below for session navigation, shared cost visibility, and safe input rewriting. This record distinguishes new implementation from existing capabilities and work that has not shipped.

## New reviewable changes

| Recommendation                                | Implementation                                                                                                                                                                                                                      | Review                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Cost-aware routing controls                   | Let project owners/admins save a default automatic routing tier. Preserve explicit model and tier choices, existing model-access rules, and project-template preferences. This is a preference, not an enforced provider allowlist. | [PR 2234](https://github.com/nicholasgriffintn/ai-platform/pull/2234) |
| Workspace spend visibility                    | Aggregate the existing usage ledger by month, source, vendor, and project for workspace owners/admins. Retain per-user billing, as requested.                                                                                       | [PR 2236](https://github.com/nicholasgriffintn/ai-platform/pull/2236) |
| First-class session branches                  | Add authorised, bounded branch-family discovery and navigation in web Chat and Work. Keep personal ownership and project membership boundaries, mark archived conversations, and handle cycles.                                     | [PR 2239](https://github.com/nicholasgriffintn/ai-platform/pull/2239) |
| Safe input rewriting, simulation, and restore | Add opt-in lossless JSON whitespace compaction for tool results, a read-only preview, revision comparison, bounded history, and restore controls in personal and project settings.                                                  | Chat input policy PR; [operator guide](chat-input-policy.md)          |

Keep these changes in separate worktrees and PRs. The chat input policy branch is based on the routing branch because both use the same authorised conversation/project resolver; review and merge the routing prerequisite first. The other two PRs target main independently.

## Existing capabilities retained

- **Outputs and sharing:** `services/outputs` already provides output revisions, share creation, revocation, expiry, and access checks. A new artifact storage or sharing subsystem would duplicate that contract.
- **Skill packages and trust:** `services/skills` already validates skill bundles and resource paths, separates user-authored from built-in instructions, stores immutable revisions, and supports draft promotion, rollback, scoped publication, and removal. Authored skills cannot acquire reserved built-in metadata or always-on status. Project management checks owner/admin authority; tool permission and approval checks remain runtime boundaries. This is a document skill system, not arbitrary npm/git code execution.
- **Provider catalogue:** registered provider adapters, model lifecycle, credentials, plan access, and automatic routing already belong to server-owned seams. A second provider catalogue would duplicate those decisions.
- **Remote execution:** the sandbox worker and its API run lifecycle already provide a remote coding path with cancellation, limits, persisted progress, and artifacts. This is not a claim that the broader provider-governance grants from ADR 0040 are implemented.
- **Durable conversations:** stored conversations, forks, goals, and compaction already exist. The branch PR adds discoverability and navigation over those records rather than replacing persistence.

These findings are based on the implementation at the branches’ base revision, not documentation alone. No new package installer, third-party dependency, shared credit balance, or parallel artifact store is introduced.

## Work still outstanding

- **Provider execution governance:** ADR 0040 is an accepted design, not an implemented enforcement layer. Provider allowlists and operation-level region, retention, storage, cache, and external-state policies need the dedicated scope-policy resolver, reviewed provider-operation profiles, and checks across chat, independent capabilities, sandbox, and training. Neither project routing preferences nor JSON rewriting supplies that authority.
- **Governed routing simulation:** show compatible candidates and rejection reasons after the execution-governance resolver exists. A preferred tier alone cannot provide an honest policy simulation.
- **Richer session continuity:** generated branch summaries and native iOS branch navigation are not part of the web branch PR. Existing conversation history remains available on iOS.
- **Broader extensions:** arbitrary executable packages, custom lifecycle hooks, and remembered trust prompts require a separate extension-host design. Existing authored skills cover portable instructions and scoped publication, not executable third-party plugins.
- **Mobile disclosure and telemetry:** native controls for policy impact and a reviewed opt-in telemetry contract remain follow-ups. No new analytics collection is introduced here.

Prioritise provider execution governance next. Its principal risk is partial enforcement: a chat-only allowlist would leave tool, background, sandbox, and training calls outside the promised boundary. Follow the staged rollout in ADR 0040 and keep any unenforced work clearly labelled in review.

## Release checks

Each new behaviour has a pending verification item under `.agents/verification/pending/`. Automated tests cover the relevant authorisation, state, validation, and persistence boundaries; they do not replace signed-in product verification after deployment. No production migration or deployment was performed for these PRs.
