# Architecture context

Use this map to find the owning app or package. Read only the relevant [architecture decision records](decisions/) when changing a durable boundary.

## Applications

- `apps/app` owns the web and PWA presentation.
- `apps/api` owns request orchestration, persistence, provider adapters, webhooks and queue tasks. Product capabilities live in `apps/api/src/modules`; host infrastructure lives in `apps/api/src/infrastructure`.
- `apps/desktop` owns the Tauri client shell, local storage and host-specific egress.
- `apps/mobile/ios` owns the native iOS client.
- `apps/sandbox-worker` runs coding tasks; `apps/computer-worker` hosts persistent graphical computers; `apps/agent-worker` hosts stateful Hermes sessions.

## Shared packages

- `packages/schemas` owns wire contracts shared across apps and workers.
- `packages/ai-*` packages provide host-facing provider, tool, model, agent, workflow, billing and telemetry interfaces.
- `packages/library-*` packages implement reusable domain mechanisms; `packages/utility-*` packages provide shared helpers.
- `packages/component-*` packages own reusable UI. Keep API and router dependencies in their owning apps, except where `component-shell` provides host integration.

## Execution and authority

- Chat uses the shared run engine; the API persists run identity, ordered events, results and terminal state. Reconnect from stored state rather than treating a live stream as durable history.
- Project task delivery, notifications and attention belong to their owning API modules. Revalidate scope and permissions at each I/O boundary.
- Sandbox runs use versioned contracts from `packages/schemas`. The API owns dispatch and project authority; the sandbox worker owns repository execution. Hosted computer sessions use fenced leases and creator-bound credentials.
- Personal credentials stay personal. Workspace connections are scoped to their workspace, and project membership does not grant another member's external credentials.
- Model-written code runs through the `LOADER` binding. Do not route it through the repository sandbox.

## Model platform

Work › Models is implemented by API modules for registry, datasets, training, serving, evaluation and governance under `/model-platform`. Provider calls run through `ai-model-providers`; reusable governance mechanisms live in `library-model-registry`.

Workspaces own provider connections and related secrets. Model versions are identified by pinned source revisions and file hashes; approvals, evidence and routes attach to versions rather than mutable names. Queue tasks handle processing and provider synchronisation; scheduled reconciliation enforces budgets and repairs stale state.

## Runtime details

Feature flags are defined in code and may be overridden through the `FLAGS` binding. The API owns persistence and public authorisation; workers receive scoped service bindings for their assigned tasks. Check the owning manifest and module before changing a binding or adding a new boundary.
