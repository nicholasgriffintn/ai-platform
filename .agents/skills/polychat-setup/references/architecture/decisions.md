# Architecture records

Read the relevant accepted records before changing product structure, ownership, persistence, connectors, or cross-app boundaries. These files are the canonical decision history for this repository; records marked proposed are not constraints until accepted.

- [0001](decisions/0001-overall-platform-architecture.md): Keep the web and API as orchestration surfaces; put provider, persistence, sandbox, and training behaviour behind focused seams.
- [0002](decisions/0002-cache-artificial-analysis-model-data.md): Cache Artificial Analysis data server-side and expose attributed results without client keys.
- [0003](decisions/0003-assistant-action-launch-contract.md): Let catalogue launch contracts, not frontend item-kind branches, define execution.
- [0004](decisions/0004-assistant-capability-descriptor.md): Share product-level capability facts while preserving different runtimes.
- [0005](decisions/0005-unified-assistant-capability-graph.md): Use one descriptor graph for availability, compatibility, auth, risk, and approval facts.
- [0006](decisions/0006-workspace-centred-work-mode.md): Keep personal Chat and workspace/project-centred Work; do not restore global apps or recipes.
- [0007](decisions/0007-project-experiences.md): Put rich workflows below projects and persist collaborative results as outputs.
- [0008](decisions/0008-contextual-assistant-composer.md): Share the composer while keeping Chat and Work discovery and authority explicit.
- [0009](decisions/0009-canonical-workspace-resources.md): Use sources, outputs, provider connections, templates, activities, and audit records as the canonical resource vocabulary.
- [0010](decisions/0010-project-context-and-user-authorised-recipes.md): Keep project context shared but recipe configuration and connector authority user-owned.
- [0011](decisions/0011-retain-audit-history-after-workspace-deletion.md): Retain immutable workspace audit history after deletion.
- [0012](decisions/0012-composio-recipe-connector-authority.md): Treat Composio's configured catalogue as recipe connector authority without bespoke fallbacks.
- [0013](decisions/0013-composio-run-approval-and-event-boundaries.md): Bind sessions, approvals, files, and events to exact local authority and fail closed on ambiguity.
- [0014](decisions/0014-frontend-package-proposal.md): Proposed extraction of public frontend packages; consult its status before treating it as accepted architecture.
- [0015](decisions/0015-model-driven-capability-discovery.md): Let models discover ready and setup-required capabilities through one read-only, scope-aware tool and render setup in the existing tool response surface.
- [0016](decisions/0016-personal-capabilities-and-experiences.md): Nest personal capabilities and experiences under Chat, make scope a parameter rather than a fork, and stop publishing function tools as apps.

[context.md](context.md) holds the current domain vocabulary, workspace map, seams, and data flows.

## Record a new decision

Add a decision only when it is hard to reverse, surprising without context, and the result of a genuine trade-off. Use the next four-digit number and include:

- problem or context;
- status;
- decision;
- consequences or trade-offs.

Update this index and the context reference when the decision changes load-bearing terminology or module ownership.
