# Architecture context

Use this map to locate current responsibilities. Read the relevant [ADR](decisions.md) for rationale; provider lifecycle 0038 and governance 0040 are accepted designs awaiting implementation, not current API guarantees.

## Vocabulary

| Term                           | Meaning                                                                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat / Work                    | Personal conversation and collaborative workspace modes sharing one conversation runtime.                                                           |
| Workspace                      | Membership and role boundary for collaborative work. Work requires its account entitlement as well as membership.                                   |
| Project                        | Shared instructions, conversations, context, capabilities and tasks inside a workspace.                                                             |
| Capability                     | An app, recipe, skill, connector, agent or tool. Configuration, enablement and authorisation are distinct.                                          |
| Experience / app               | A rich workflow from `/capabilities`; an experience with an owning capability is presented as an app. `apps/*` instead means deployable workspaces. |
| Scope                          | Personal or project ownership passed to shared components and services. Agents additionally support workspace ownership.                            |
| Source / output                | Durable input / result. A project ID makes the resource collaborative; a conversation link adds provenance.                                         |
| Provider connection            | A person's external authority. Work does not inherit another member's credentials.                                                                  |
| Skill / agent                  | Loadable instructions / a saved persona with capability requests. Neither grants execution permission.                                              |
| Task / flow                    | Durable project work with its own conversation and goal / ordered execution stages. Distinct from the internal `tasks` queue.                       |
| Activity / audit               | User-visible execution history / immutable workspace governance history retained after deletion.                                                    |
| Credit / reserve / reservation | Metered allowance / plan grace beyond the allowance / held estimate for work not yet settled.                                                       |

## Deployables and shared packages

| Location               | Responsibility                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| `apps/app`             | React Router web/PWA. Controllers bind server queries, local storage, UI preferences and presentation.          |
| `apps/api`             | Hono Worker: public auth, request validation, persistence, providers, queues, schedules and webhooks.           |
| `apps/mobile/ios`      | Swift client with its own wire and stream consumers.                                                            |
| `apps/sandbox-worker`  | Isolated coding execution, approvals, cancellation and task events.                                             |
| `apps/training`        | Internal provider training/deployment execution and persisted job events.                                       |
| `packages/schemas`     | Shared Zod contracts, stream events and pricing primitives.                                                     |
| `packages/library-*`   | Reusable runtime behaviour; agent loop, tool runtime, registry, client and chat libraries have distinct owners. |
| `packages/component-*` | React presentation receiving data and emitting typed intents. No router, store or API imports.                  |
| `packages/utility-*`   | Shared stateless helpers.                                                                                       |

## API entry points

Paths below are relative to `apps/api/src`.

| Responsibility                        | Start here                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| HTTP / request context                | `lib/http/routeBuilder.ts`, `lib/context/serviceContext.ts`                      |
| D1 persistence                        | `repositories/`, `lib/database/schema.ts`                                        |
| Workspace and project access          | `services/workspaces/access.ts`                                                  |
| Sources, outputs and templates        | Their owning `services/` and repository modules                                  |
| Provider adapters / model policy      | `lib/providers/registry/`, `lib/providers/models/policy.ts`                      |
| Model defaults                        | `packages/schemas/src/model-defaults.ts` at repository root                      |
| Tool catalogue / execution            | `services/functions/definitions/` / `services/functions/index.ts`                |
| Skills and revisions                  | `services/skills/`, `AuthoredSkillRepository`; built-ins in `data-model/skills/` |
| Agent access and request assembly     | `services/agents/access.ts`, `services/agents/completion-request.ts`             |
| Project task dispatch and interaction | `services/project-tasks/`, `ProjectTaskRepository`                               |
| Connector sessions and approvals      | `services/apps/connectors/`                                                      |
| Realtime catalogue and sessions       | `services/realtime/`, registered realtime adapters                               |
| Usage and credits                     | `lib/usage/`, `UsageEventRepository`, plan records in D1                         |

## Conversation execution

`lib/chat/core` orchestrates requests. `validation` and `preparation` establish model, scope and prompt state; `agent` runs the shared loop; `messages`, `streaming`, `tools` and `policy` own their named responsibilities. Keep feature internals out of the top-level orchestrator.

Both streamed and buffered turns use common finalisation and goal policy. Turn completion owns persistence, connector cleanup and lock release. Disconnection detaches SSE; it does not finish the run. Recovery polls stored history and the coordinator’s active operation, restoring web activity after refresh or navigation. A recent local pending message bridges the period before the server stores the turn; explicit cancellation uses the separate stop endpoint. This is best-effort Worker continuation, not a durable event-replay system.

`services/conversations/coordinator/client.ts` serialises history mutations at their entry points. The lock is non-reentrant and lease-bounded. Tool-result compaction removes JSON formatting whitespace before provider calls without changing values, protocol fields or stored history; it has no settings or saved policy. `lib/session` owns history compaction; display-only compaction and goal markers stay out of model input. Async provider jobs use `lib/async` and polling handlers, with terminal writes taking the same lock.

Managed tool selection starts small and activates eligible tools after discovery or skill loading. Project grants constrain that activation. Saved agents layer personas into the generated prompt and request tools/skills within the runner's scope. Project tasks use the same engine, with exact dispatch identity and durable question, approval and stage-completion records.

## Data and authority

Authorise project reads and conversations through current workspace membership; apply each resource's management roles separately. Keep private files behind Source/Output access and resolve their bytes server-side before provider calls. Project context is curated explicitly, and built-in memories are owned by the memory service.

Authored skills use D1 identity and stable/draft pointers with immutable private R2 bundles. Pin one stable revision per request while revalidating access on each load. Retrieval similarly uses provider matches only as candidates: active scoped D1 records authorise content, and immutable vector provenance governs cleanup.

Composio owns configured connector credentials and tool schemas. Polychat owns scoped session handles, exact-action approvals, event mappings and cleanup. A queue record, catalogue match or model-produced argument is never authority by itself.

Credit admission reads persisted plan allowances; missing allowances refuse work. The signed-in ledger records idempotent vendor-unit spend, while anonymous actors use running totals. BYOK model/hosted-tool spend is uncharged; other metered work is not. Workspace reporting is attribution, not a shared balance. See [usage operations](../operations/loop-cost-controls.md).

## Web boundaries

`apps/app/src/lib/api/fetch-wrapper.ts` owns credentials, CSRF, timeouts and API error handling. React Query hooks own remote/local coordination and invalidation; the authenticated store owns hydrated user/settings state. `lib/local/local-chat-service.ts` owns local conversation persistence.

Keep customisation drafts in `component-account` as field-level edits over hydrated settings. Refresh untouched controls as settings arrive, preserve local edits until the server returns matching values, and discard drafts when the settings identity changes.

Chat and Work compose the same `ConversationThread` and scoped capability surfaces. Keep backend catalogue metadata authoritative and project request metadata intact. Automatic routing admits text-response chat models, excluding media generation, realtime and specialist extraction models; multimodal chat inputs remain eligible. Failed AI prompt analysis falls back to keyword requirements before scoring eligible models. Host controllers supply resolved links and actions to render packages through their existing providers.

Use shared UI primitives for buttons, dialogs, focus, overlays and reduced motion. Tool messages and parts share `ToolResultView`; declared renderers and payload shape choose the body. Stream rendering coalesces text updates while preserving event order. API and iOS share contract semantics even where their presentation differs.
