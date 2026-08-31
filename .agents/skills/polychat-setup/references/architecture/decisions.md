# Architecture records

Read the relevant accepted records before changing product structure, ownership, persistence, connectors, or cross-app boundaries. These files are the canonical decision history for this repository.

- [0001](decisions/0001-overall-platform-architecture.md): Keep the web and API as orchestration surfaces; put provider, persistence, sandbox, and training behaviour behind focused seams.
- [0002](decisions/0002-cache-artificial-analysis-model-data.md): Cache Artificial Analysis data server-side and expose attributed results without client keys.
- [0005](decisions/0005-unified-assistant-capability-graph.md): Use one descriptor graph for availability, compatibility, auth, risk, and approval facts. Supersedes the separate launch-contract and capability-descriptor records.
- [0006](decisions/0006-workspace-centred-work-mode.md): Keep personal Chat and workspace/project-centred Work; do not restore global apps or recipes.
- [0007](decisions/0007-project-experiences.md): Put rich workflows below projects and persist collaborative results as outputs.
- [0008](decisions/0008-contextual-assistant-composer.md): Share the composer while keeping Chat and Work discovery and authority explicit.
- [0009](decisions/0009-canonical-workspace-resources.md): Use sources, outputs, provider connections, templates, activities, and audit records as the canonical resource vocabulary.
- [0010](decisions/0010-project-context-and-user-authorised-recipes.md): Keep project context shared but recipe configuration and connector authority user-owned.
- [0011](decisions/0011-retain-audit-history-after-workspace-deletion.md): Retain immutable workspace audit history after deletion.
- [0012](decisions/0012-composio-recipe-connector-authority.md): Treat Composio's configured catalogue as recipe connector authority without bespoke fallbacks.
- [0013](decisions/0013-composio-run-approval-and-event-boundaries.md): Bind sessions, approvals, files, and events to exact local authority and fail closed on ambiguity.
- [0015](decisions/0015-model-driven-capability-discovery.md): Let models discover ready and setup-required capabilities through one read-only, scope-aware tool and render setup in the existing tool response surface.
- [0016](decisions/0016-personal-capabilities-and-experiences.md): Nest personal capabilities and experiences under Chat, make scope a parameter rather than a fork, and stop publishing function tools as apps.
- [0017](decisions/0017-scope-capability-configuration.md): Store capability configuration against an explicit scope without coupling it to enablement or one capability family.
- [0018](decisions/0018-skills-as-loadable-instructions.md): Move specialised instructions into portable Agent Skills documents the model loads on demand, and drop the per-model artifact flag.
- [0019](decisions/0019-store-authored-skills-as-r2-documents.md): Keep user-authored skills as scope-keyed private R2 documents, using project capabilities and audit records for Work governance instead of adding a skill table. Its mutable storage decision is superseded by ADR 0030.
- [0020](decisions/0020-backend-shared-package-boundaries.md): Extract a backend package only where a second consumer already exists; judge candidates by duplication and coupling rather than module size.
- [0021](decisions/0021-prompt-behaviour-belongs-in-skills.md): Move prompt-shaped tooling — prompt coaching, tutoring, reasoning steps, orchestration helpers, and council — into skills, add skill-suggested tools, and replace the client council loop and its chat mode with a server-side panel tool.
- [0022](decisions/0022-one-turn-engine.md): Run every chat turn through the shared agent loop, with streaming as a transport rather than a pipeline of its own.
- [0023](decisions/0023-agents-are-chat-completions-with-a-persona.md): Layer a saved agent's identity into the generated prompt as a persona, and keep `system_prompt` as a full override for API callers.
- [0024](decisions/0024-turns-outlive-the-connection.md): Keep SSE and let the turn outlive the client with `waitUntil`, recover by polling for the persisted answer, and delete background mode.
- [0025](decisions/0025-tool-result-presentation-by-shape.md): Render every tool result through one view, let tools declare a renderer id, and resolve anything undeclared from the payload's shape.
- [0026](decisions/0026-project-task-boards.md): Make the unit of work in Work a project task that carries its own conversation and goal; every stage stores a completion snapshot, and its flow policy selects automated hand-off or explicit human approval.
- [0027](decisions/0027-project-flow-approval-authority.md): Make a Work stage's saved approval policy authoritative for its task run, and resume an approval-blocked task through an exact pending tool decision.
- [0028](decisions/0028-response-scoped-capability-activation.md): Let discovery activate eligible native tools for the current response without changing saved settings or widening setup and project authority.
- [0029](decisions/0029-server-managed-tool-selection.md): Let the server own function tool selection for Chat and iOS through a managed request mode, keep explicit selection for the API and agents, and drop the composer tool picker.
- [0030](decisions/0030-server-owned-model-selection-policy.md): Let the server own executable-model policy and plan-, provider-, and BYOK-aware defaults while clients consume the resolved catalogue default or automatic routing.
- [0031](decisions/0031-registry-owned-realtime-provider-catalogue.md): Derive realtime provider discovery and readiness from registered backend adapters while keeping one non-ready browser fallback.
- [0032](decisions/0032-version-authored-skills-with-d1-state-and-r2-bundles.md): Give authored skills D1 identity and draft/stable state while storing complete immutable revisions in private R2.
- [0033](decisions/0033-separate-embedding-runtime-and-retrieval-policy.md): Separate embedding generation and vector storage, persist exact vector-space provenance, and keep retrieval model-driven.
- [0034](decisions/0034-agent-owning-scope.md): Give a saved agent an owning scope of user or workspace, keep `user_id` as the author, and publish to a workspace by copying rather than by reference.
- [0035](decisions/0035-tool-catalogue-split-from-tool-implementations.md): Split tool descriptors from tool implementations so the provider layer reads the catalogue as data and never imports the provider registry.
- [0036](decisions/0036-agents-composed-from-platform-capabilities.md): Let a saved agent name skills and a mode, treating each as a request checked at run time rather than a grant, and leave connectors and sources out until a request seam carries them.
- [0037](decisions/0037-retire-team-agents-for-project-flows.md): Retire team agents and their delegation tools, since project flows already sequence multi-agent work with approval gates and durable stage snapshots.

[context.md](context.md) holds the current domain vocabulary, workspace map, seams, and data flows.

## Archived records

Removed because they no longer earn their place. Their surviving content is named here so the numbers are not reused and the history is not silently rewritten.

- **0003 assistant action launch contract** and **0004 assistant capability descriptor**: two steps of one arc that [0005](decisions/0005-unified-assistant-capability-graph.md) finished. 0005 states the current contract — a catalogue item carries both `capability` and `launch` — and 0004 additionally described a `dynamic-apps` service that no longer exists.
- **0014 frontend package proposal**: a migration plan, never accepted as a decision, whose extraction has since shipped as `packages/component-*`, `library-*`, and `utility-*`. Its module and line-count audit described a tree that has moved on, and its package renames are already applied. The bar it set for a package — a stable interface, hidden implementation, and a credible independent consumer — is restated in [0020](decisions/0020-backend-shared-package-boundaries.md), and its control and build rules for render packages live in the frontend render package seam in [context.md](context.md).

## Record a new decision

Add a decision only when it is hard to reverse, surprising without context, and the result of a genuine trade-off. Use the next four-digit number and include:

- problem or context;
- status;
- decision;
- consequences or trade-offs.

Update this index and the context reference when the decision changes load-bearing terminology or module ownership.
