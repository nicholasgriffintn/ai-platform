# Architecture context

Use this map to locate current responsibilities. Read the relevant [decision](decisions.md) for rationale rather than restating it here. The desktop application is implemented but not released.

## Vocabulary

| Term                           | Meaning                                                                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Chat / Work                    | Personal conversation and collaborative workspace modes sharing one conversation runtime.                                         |
| Workspace                      | Membership and role boundary for collaborative work. Work requires its account entitlement as well as membership.                 |
| Project                        | Shared instructions, conversations, context, capabilities and tasks inside a workspace.                                           |
| Project Workbench              | Responsive presentation of a coding-enabled project conversation in Work; not a mode, route, runtime or persisted resource.       |
| Capability                     | An app, recipe, skill, connector, teammate or tool. Configuration, enablement and authorisation are distinct.                     |
| Experience / App               | A rich workflow shown to people as an App and opened through one scoped `AppRoute`. `apps/*` instead means deployable workspaces. |
| Place                          | A shared destination every sidebar links to under Search: Attention, Files and Teammates.                                         |
| Files                          | The user-facing name for Sources (Given) and Outputs (Made). Records keep their own names.                                        |
| Teammate                       | A saved persona, hired from a role or a job description, with a `colleague` or `bot` kind. Named teammate in every layer.         |
| Poly / meta scope              | The per-user meta assistant: a `meta` conversation receiving only product-operating tools, re-authorising every reference.        |
| Scope                          | Personal or project ownership passed to shared components and services. Teammates additionally support workspace ownership.       |
| Source / output                | Durable input / result. A project ID makes the resource collaborative; a conversation link adds provenance.                       |
| Provider connection            | A person's external authority. Work does not inherit another member's credentials.                                                |
| Skill                          | Loadable instructions. Loading one grants no execution permission.                                                                |
| Task / flow                    | Durable project work with its own conversation and goal / ordered execution stages. Distinct from the internal `tasks` queue.     |
| Run                            | One accepted, stored unit of chat execution with its own `run_<id>`, attempt, status and bounded event journal.                   |
| Attention / inbox              | Membership-filtered projection of actionable, active, failed and recent task or run state / its per-person read and dismissal.    |
| Activity / audit               | User-visible execution history / immutable workspace governance history retained after deletion.                                  |
| Conversation organisation      | Per-user pin, unread and snooze state plus one personal or project-scoped group per conversation; never authority.                |
| Credit / reserve / reservation | Metered allowance / plan grace beyond the allowance / held estimate for work not yet settled.                                     |
| Model runtime                  | A stateless completion server such as Ollama or LM Studio. Polychat owns the conversation, prompt, tools and memory.              |
| Agent runtime                  | A self-hosted gateway owning its own sessions, memory and tool execution. Polychat is a surface onto it and approves each action. |

Agent still names three things that are not the persona: the turn engine's loop, the execution modes it runs in, and its recorded traces.

## Deployables and shared packages

| Location                   | Responsibility                                                                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/app`                 | React Router web and PWA. Controllers bind server queries, local storage, UI preferences and presentation.                                            |
| `apps/api`                 | Hono Worker: public auth, request validation, persistence, providers, queues, schedules and webhooks.                                                 |
| `apps/mobile/ios`          | Swift client with its own wire and stream consumers.                                                                                                  |
| `apps/desktop`             | Tauri shell: a webview registering shared pages, plus a Rust core owning allowlisted egress, storage, secrets, sign-in, notifications and deep links. |
| `apps/sandbox-worker`      | Isolated coding execution, approvals, cancellation and task events.                                                                                   |
| `apps/training`            | Internal provider training and deployment execution with persisted job events.                                                                        |
| `packages/schemas`         | Shared Zod contracts, stream events and pricing primitives.                                                                                           |
| `packages/library-*`       | Reusable runtime behaviour. `library-agent-core`, `library-tool-runtime`, `library-registry`, `library-client`, `library-chat` have distinct owners.  |
| `packages/component-*`     | React presentation receiving data and emitting typed intents. No router, store or API imports.                                                        |
| `packages/component-shell` | The one connected exception: the pages both web and desktop serve. Reads stores and router; takes host differences through `ShellHostProvider`.       |
| `packages/utility-*`       | Shared stateless helpers.                                                                                                                             |

## API entry points

Paths are relative to `apps/api/src`.

| Responsibility                        | Start here                                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| HTTP and request context              | `lib/http/routeBuilder.ts`, `lib/context/serviceContext.ts`                                           |
| D1 persistence                        | `repositories/`, `lib/database/schema.ts`                                                             |
| Workspace and project access          | `services/workspaces/access.ts`                                                                       |
| Sources, outputs and templates        | Their owning `services/` and repository modules                                                       |
| Provider adapters and model policy    | `lib/providers/registry/`, `lib/providers/models/policy.ts`                                           |
| Model catalogue resolution            | `data-model/models/`, `lib/providers/models/catalogue-definition.mts`                                 |
| Model tiers and system lineups        | `packages/schemas/src/model-lineup.ts`; `lib/chat/policy/model-access.ts`, `system-models.ts`         |
| Tool catalogue and execution          | `services/functions/definitions/`, `services/functions/index.ts`                                      |
| Meta assistant scope and tools        | `lib/chat/policy/meta-assistant.ts`, `services/functions/meta.ts`, `lib/prompts/meta-assistant.ts`    |
| Skills and revisions                  | `services/skills/`, `AuthoredSkillRepository`; built-ins in `data-model/skills/`                      |
| Teammate access and request assembly  | `services/teammates/access.ts`, `services/teammates/completion-request.ts`, `hire.ts`                 |
| Project task dispatch and interaction | `services/project-tasks/`, `ProjectTaskRepository`                                                    |
| Attention and notification delivery   | `services/attention/`, `AttentionRepository`, `services/task-notifications/`, `services/mobile-push/` |
| Connector sessions and approvals      | `services/apps/connectors/`                                                                           |
| Realtime catalogue and sessions       | `services/realtime/`, registered realtime adapters                                                    |
| Usage and credits                     | `lib/usage/`, `UsageEventRepository`, plan records in D1                                              |
| Desktop downloads and updates         | `services/desktop-releases/`, `routes/desktop.ts`                                                     |

## Conversation execution

`lib/chat/core` orchestrates requests. `validation` and `preparation` establish model, scope and prompt state; `agent` runs the shared loop; `messages`, `streaming`, `tools` and `policy` own their named responsibilities. Keep feature internals out of the top-level orchestrator.

Both streamed and buffered turns use common finalisation and goal policy, and turn completion owns persistence, connector cleanup and lock release. Every authenticated stored execution receives a `run_<id>` and versioned command receipt independent of its conversation, messages, model steps and tool calls. Disconnection detaches SSE but does not finish the run: the submitting client renders only its live stream, while a client that later opens a conversation with a detached active run anchors an authorised snapshot and polls ordered events after that cursor. See [0005](decisions/0005-one-turn-engine-separate-from-transport.md) and [0006](decisions/0006-persist-run-identity-and-ordered-events.md).

`services/conversations/coordinator/client.ts` serialises history mutations at their entry points with an owner-token lease; `lib/conversation/write-fence.ts` is the persistence-boundary contract the conversation manager reuses. `lib/session` owns history compaction: a snapshot records the exact message IDs fully represented within its bounded summary input, and one D1 batch inserts the snapshot and marker, archives only that covered prefix and refreshes metadata. Async provider jobs use `lib/async` and polling handlers, with terminal writes taking the same lock.

`lib/chat/policy/context-budget.ts` fits each model step and records what was included or omitted; `lib/chat/policy/provider-retry.ts` owns retry classification, delay and run-wide attempt accounting.

`packages/schemas/src/chat-stream.ts` owns the provider-neutral stream vocabulary and `lib/chat/streaming` emits ephemeral turn activity. `packages/library-chat/src/turn-activity.ts` projects it for shared web surfaces; iOS keeps an equivalent native projection. Activity is presentation state, not execution authority or durable history.

Queue-dispatched stored project tasks are the durable execution cohort. The queue task holds a renewable persisted owner lease, and both task settlement and project-task state commits compare that owner. Redelivery reconciles persisted success or a waiting interaction, but marks mid-run owner loss interrupted rather than replaying model or tool work.

Multi-model deliberation runs on one shared, linear context. `lib/chat/panel.ts` drives both the council and second opinions: members speak one at a time, each reads the transcript of everything said before it, and a concluding turn reads the whole transcript and writes the result. Members never share a mutable scratchpad. A member's failure is logged and skipped rather than retried in place, and every turn's usage is attributed to the runner. Extend multi-teammate work the same way — same readable context, merged results — rather than letting participants write to shared state.

## Work

`services/project-tasks/` owns dispatch, interaction state and the reconstructed activity projection; a task snapshots its selected flow and every accepted run stores its exact stage ID, so stage state derives from persisted attempts rather than plan position. `services/attention/` and `AttentionRepository` join current membership to project tasks and sandbox Activity and return the operational read model; `services/task-notifications/` owns the delivery outbox and gateway, while `services/mobile-push/` still signs and sends iOS Work alerts to APNs directly. `services/conversation-organisation/` owns pin, unread, snooze and groups over `ConversationOrganisationRepository`. `services/apps/recipes/scheduler.ts` is the only user-work due scanner and enqueues `recipe_execution` tasks. See decisions [0018](decisions/0018-project-tasks-run-through-governed-flows.md) to [0021](decisions/0021-separate-conversation-state-from-project-groups.md).

## Coding runs

`packages/schemas/src/sandbox*.ts` own the versioned command, delivery, environment, cache, service, preview and manifest contracts. The sandbox worker reports repository, change, validation and delivery evidence; `services/apps/sandbox/run-manifest.ts` combines it with authoritative run state, and `run-artifacts.ts` stores bulky evidence as private Outputs before attaching compact authorised references. `packages/library-chat/src/run-activity.ts` projects the conversation trace and ordered run events into one display sequence.

`routes/apps/sandbox/runs-lifecycle.ts` exposes authorised event and instruction reads and compare-and-set control updates; `services/apps/sandbox/runs.ts` separates project visibility from runner-only steering. `services/workspaces/environment-cache.ts` resolves and invalidates the project-owned environment snapshot, and `services/apps/sandbox/previews.ts` with `preview-grants.ts` creates and authorises preview sessions. In the worker, `environment-setup.ts`, `service-supervisor.ts`, `preview-gateway.ts`, `github-delivery.ts` and `execution-control.ts` own their named responsibilities.

Backup handles, container addresses, SDK URLs and forwarding tokens never enter stored run data, coordinator events, client responses or logs. Do not add a workbench table, execution service, top-level route or copied iOS contract semantics. See decisions [0023](decisions/0023-present-coding-work-in-project-conversations.md) to [0026](decisions/0026-output-provenance-and-safe-restores.md).

## Data and authority

Authorise project reads and conversations through current workspace membership; apply each resource's management roles separately. Keep private files behind Source and Output access and resolve their bytes server-side before provider calls. Authored skills use D1 identity and stable/draft pointers with immutable private R2 bundles. Retrieval uses provider matches only as candidates: active scoped D1 records authorise content, and immutable vector provenance governs cleanup. Composio owns configured connector credentials and tool schemas, while Polychat owns scoped session handles, exact-action approvals, event mappings and cleanup. A queue record, catalogue match or model-produced argument is never authority by itself.

Credit admission reads persisted plan allowances; missing allowances refuse work. Stored run usage groups ledger events by stable run and attempt but keeps the reservation, recorded consumption and settlement distinct, and missing provider telemetry is unknown rather than zero. Workspace reporting is attribution, not a shared balance. See [usage operations](../operations/loop-cost-controls.md) and [0022](decisions/0022-meter-vendor-units-and-settle-once.md).

## Web and desktop

`services/machines/run-coordinator.ts` owns short-lived model requests and ordered output for each account and machine. The authenticated machine routes check ownership and current advertisement; the desktop consumer claims requests and invokes the native model backend. Web and iOS callers retain the chosen machine and persist the returned conversation through the usual storage path. The relay retains at most twenty requests and replies for up to ten minutes; desktop disconnection fails an active request after thirty seconds.

Desktop diagnostics do not read credentials. The native secret cache coalesces Keychain access until sign-in or sign-out changes a value. The macOS Cargo runner signs development executables with `APPLE_SIGNING_IDENTITY`, or the sole installed Apple development identity, to retain application identity across rebuilds. Development uses the `authenticated-session` credential slot without importing the older `session-token` ACL; existing installations sign in once to create that credential. The background service runs the same hidden Tauri application and relay consumer as the foreground app.

`packages/component-shell/src/Shell/ProductShell.tsx` renders every product route for both hosts: the sidebar, content column and overlays, with the Chat and Work toggle in the header. The places behind the shared links — Attention, Files, the capability library and the teammate editor — live in the same package, framed by `ChatPlaceShell` and `WorkPlaceShell`, alongside the conversation home and the Discover tour. The web mounts each from its route modules and the desktop from `apps/desktop/src/pages/<place>`, where a directory holding `routes.ts` and `page.tsx` is the whole registration and a place with no directory answers 404. Dialogs both hosts share live in `Host/ShellDialogs.tsx`; host-specific dialogs and actions arrive through `ShellHostProvider`.

In `packages/library-react/src`, `lib/navigation/places.ts` owns place paths and active-place resolution, `lib/conversation-route.ts` owns personal and project conversation paths, and `state/conversation-scope.tsx` lets a subtree run the shared `ConversationThread` against its own conversation id, which is how the Poly overlay hosts a second conversation over the open page.

`packages/library-react/src/chat/useModelPickerCatalogue.ts` combines scoped model discovery and saved selection context for the picker. `useLastModelSelection.ts` saves an account preference through the existing authenticated settings path; presentation packages receive models and callbacks. Browser catalogue metadata is generated separately from the WebLLM engine so search does not load inference code.

`packages/library-client/src/fetch-wrapper.ts` owns credentials, CSRF, timeouts and API error handling. React Query hooks own remote and local coordination and invalidation; the authenticated store owns hydrated user and settings state. `packages/library-chat/src/local-conversation-store.ts` owns the local conversation contract, with the IndexedDB implementation in `packages/library-react/src/local/`. Keep customisation drafts in `component-account` as field-level edits over hydrated settings.

`packages/component-ui/src/styles.css` owns the semantic colour and font tokens, one block per named theme selected by `data-polychat-theme`, with `tokens.css` mapping them to framework utilities and `packages/library-chat/src/theme.ts` as the registry those blocks answer to. Feature components consume semantic roles; identity colour resolves through the `--polychat-accent-*` scale rather than raw palette classes. The same stylesheet owns shared motion durations, easing and primitives: active-execution motion signals activity, never completion percentage, reduced-motion rules make those primitives static, and ambient consumers expose `data-active-work="true"` so continuous decoration pauses during work.

Presentation components emit typed, optionally asynchronous intents and show local acknowledgement only after the host action succeeds; persisted interaction state remains authoritative. Unknown interaction types stay visible but non-actionable. The stable task destination is `(workspaceId, projectId, taskId, conversationId?)`, and inbox and push links resolve it against current state and access rather than treating a message as authority. See [streaming operations](../operations/streaming-responsiveness.md) and [0009](decisions/0009-bound-live-streams-and-page-history.md) for the transport and rendering bounds.
