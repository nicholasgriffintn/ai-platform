# Architecture decisions

Read the relevant record before changing a durable boundary. These are consolidated decisions, not an implementation changelog; [context](context.md) describes the current code.

## Platform and product shape

- [0001: Keep implementation behind app and package boundaries](decisions/0001-app-and-package-boundaries.md)
- [0002: Share one runtime across Chat and Work](decisions/0002-chat-and-work-share-one-runtime.md)
- [0003: Use scoped resources and explicit authority](decisions/0003-scoped-resources-and-explicit-authority.md)
- [0004: Render one shell with one user-facing vocabulary](decisions/0004-one-shell-and-one-vocabulary.md)
- [0031: Run workspace tasks through Vite+](decisions/0031-run-workspace-tasks-through-vite-plus.md)
- [0032: Ship the navigation shell as preserved modules](decisions/0032-ship-navigation-shell-as-preserved-modules.md)

## Running a turn

- [0005: Run one turn engine and separate it from transport](decisions/0005-one-turn-engine-separate-from-transport.md)
- [0006: Persist run identity and an ordered event journal](decisions/0006-persist-run-identity-and-ordered-events.md)
- [0007: Budget and report the context of each model step](decisions/0007-budget-and-report-model-context.md)
- [0008: Bound model retries and surface unknown writes](decisions/0008-bound-model-retries-and-unknown-writes.md)
- [0009: Bound live streams and page durable history](decisions/0009-bound-live-streams-and-page-history.md)

## Models, tools and capabilities

- [0010: Discover and activate tools within the current response](decisions/0010-discover-and-activate-tools-in-response.md)
- [0011: Resolve models, tiers and readiness on the server](decisions/0011-resolve-models-and-readiness-on-the-server.md)
- [0012: Share model definitions across provider offerings](decisions/0012-share-model-definitions-across-offerings.md)
- [0013: Load skills on demand and version authored content](decisions/0013-load-skills-on-demand.md)
- [0014: Keep retrieval authority in D1 and preserve vector provenance](decisions/0014-retrieval-authority-and-vector-provenance.md)
- [0015: Hire teammates from roles and call them teammates everywhere](decisions/0015-teammates-hired-from-roles.md)
- [0016: Keep meta tools in the meta scope](decisions/0016-meta-tools-belong-to-the-meta-scope.md)
- [0017: Bind connector execution to exact local authority](decisions/0017-bind-connector-execution-to-local-authority.md)

## Work

- [0018: Run project tasks through governed flows](decisions/0018-project-tasks-run-through-governed-flows.md)
- [0019: Keep repeatable scheduling in recipes](decisions/0019-keep-repeatable-scheduling-in-recipes.md)
- [0020: Derive attention from authoritative work state and revalidate every delivery](decisions/0020-derive-attention-and-revalidate-delivery.md)
- [0021: Separate personal conversation state from project groups](decisions/0021-separate-conversation-state-from-project-groups.md)
- [0022: Meter vendor units, admit against credits and settle once](decisions/0022-meter-vendor-units-and-settle-once.md)

## Coding runs

- [0023: Present coding work inside project conversations](decisions/0023-present-coding-work-in-project-conversations.md)
- [0024: Declare sandbox delivery, environment and services explicitly](decisions/0024-declare-sandbox-delivery-environment-and-services.md)
- [0025: Gate sandbox previews through current project authority](decisions/0025-gate-sandbox-previews-through-project-authority.md)
- [0026: Snapshot output provenance and append safe restores](decisions/0026-output-provenance-and-safe-restores.md)

## Clients

- [0027: Name themes and ship a house type pairing through tokens](decisions/0027-named-themes-and-house-type.md)
- [0028: Give the desktop shell a core that owns egress and one shared navigation shell](decisions/0028-desktop-core-owns-egress.md)
- [0029: Separate model runtimes from agent runtimes](decisions/0029-separate-model-and-agent-runtimes.md)
- [0030: Release applications from changesets and hand out builds through the API](decisions/0030-release-applications-from-changesets.md)

## Maintaining these records

Records 0001–0030 were renumbered contiguously when 44 earlier records were consolidated into these 30; earlier numbers do not map onto them and are not referenced anywhere. The next new decision is 0033. Do not reuse a retired number.

Add a record only for a durable trade-off that code alone cannot explain. State the problem, the decision, its status and its consequences, then update this index. Merge a record into an existing one rather than adding a second account of the same boundary. Keep rollout plans, copied schemas and unimplemented proposals out of these files.
