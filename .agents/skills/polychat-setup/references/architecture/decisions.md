# Architecture decisions

Read the relevant record before changing a durable boundary. These are consolidated decisions, not an implementation changelog. The [context](context.md) describes the current code and labels accepted boundaries that are not yet implemented.

## Implemented boundaries

- [0001: Keep implementation behind app and package boundaries](decisions/0001-overall-platform-architecture.md) — incorporates 0020, 0025, 0035.
- [0006: Share capabilities across Chat and Work](decisions/0006-workspace-centred-work-mode.md) — incorporates 0007, 0008, 0016.
- [0009: Use scoped resources and explicit authority](decisions/0009-canonical-workspace-resources.md) — incorporates 0010, 0011, 0017.
- [0013: Bind connector execution to exact local authority](decisions/0013-composio-run-approval-and-event-boundaries.md) — incorporates 0012.
- [0024: Run one turn engine and separate it from transport](decisions/0024-turns-outlive-the-connection.md) — incorporates 0022, 0039.
- [0026: Run project tasks through governed flows](decisions/0026-project-task-boards.md) — incorporates 0027, 0037.
- [0029: Discover and activate tools within the current response](decisions/0029-server-managed-tool-selection.md) — incorporates 0005, 0015, 0028.
- [0030: Resolve model and realtime availability on the server](decisions/0030-server-owned-model-selection-policy.md) — incorporates 0002, 0031.
- [0032: Load skills on demand and version authored content](decisions/0032-version-authored-skills-with-d1-state-and-r2-bundles.md) — incorporates 0018, 0019, 0021.
- [0033: Keep retrieval authority in D1 and preserve vector provenance](decisions/0033-separate-embedding-runtime-and-retrieval-policy.md).
- [0036: Compose scoped agents from platform capabilities](decisions/0036-agents-composed-from-platform-capabilities.md) — incorporates 0023, 0034.
- [0041: Meter vendor units and admit turns against credits](decisions/0041-usage-metering-and-credits.md) — incorporates 0042.
- [0043: Present coding work inside project conversations](decisions/0043-project-workbench-presentation.md).
- [0044: Name themes and resolve them from one attribute](decisions/0044-named-themes-over-a-light-dark-toggle.md).
- [0045: Require an explicit sandbox delivery policy](decisions/0045-require-explicit-sandbox-delivery-policy.md).
- [0046: Version sandbox environment preparation](decisions/0046-version-sandbox-environment-preparation.md).
- [0047: Scope and invalidate sandbox environment snapshots](decisions/0047-scope-and-invalidate-sandbox-environment-snapshots.md).
- [0048: Supervise declared project services within a coding run](decisions/0048-supervise-declared-project-services.md).
- [0049: Gate sandbox previews through current project authority](decisions/0049-gate-sandbox-previews-through-current-project-authority.md).
- [0050: Derive global Attention from authoritative work state](decisions/0050-derive-global-attention-from-authoritative-work-state.md).
- [0051: Separate personal conversation state from project labels](decisions/0051-separate-personal-conversation-state-from-project-labels.md).
- [0052: Keep repeatable scheduling in recipes](decisions/0052-keep-repeatable-scheduling-in-recipes.md).
- [0053: Deliver mobile Work notifications without moving authority](decisions/0053-deliver-mobile-work-notifications-without-moving-authority.md).
- [0054: Ship a house type pairing through font tokens](decisions/0054-house-type-pairing.md).
- [0055: Keep the home route an app and put the tour beneath it](decisions/0055-keep-the-home-route-an-app.md).

## Accepted designs awaiting implementation

- [0038: Scope future model lifecycle to a provider surface](decisions/0038-provider-surface-model-lifecycle.md).
- [0040: Resolve future provider governance before execution](decisions/0040-provider-execution-governance-policy.md).

Keep surviving record numbers stable; gaps are intentional. Records 0003 and 0004 were previously folded into 0005, now 0029. The retired 0014 package proposal is covered by 0001. Do not reuse retired numbers; the next new decision is 0056.

Add a record only for a durable trade-off that code alone cannot explain. State the problem, decision, implementation status and consequence; update this index. Keep rollout plans and copied schemas out of ADRs.
