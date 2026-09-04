# Architecture decisions

Read the relevant record before changing a durable boundary. These are consolidated decisions, not an implementation changelog. The [context](context.md) describes the current code.

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

## Accepted designs awaiting implementation

- [0038: Scope future model lifecycle to a provider surface](decisions/0038-provider-surface-model-lifecycle.md).
- [0040: Resolve future provider governance before execution](decisions/0040-provider-execution-governance-policy.md).

Keep surviving record numbers stable; gaps are intentional. Records 0003 and 0004 were previously folded into 0005, now 0029. The retired 0014 package proposal is covered by 0001. Do not reuse retired numbers; the next new decision is 0043.

Add a record only for a durable trade-off that code alone cannot explain. State the problem, decision, implementation status and consequence; update this index. Keep rollout plans and copied schemas out of ADRs.
