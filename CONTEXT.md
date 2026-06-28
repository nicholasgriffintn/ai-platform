# Polychat Architecture Context

Polychat is a multi-model assistant platform. It combines hosted chat, agents, retrieval, generated media, realtime sessions, workflow-style apps, metrics, training control, and sandboxed coding runs in one monorepo.

Use this file as the domain context for architecture reviews. Keep new terms here when they become load-bearing concepts, and use the architecture skill vocabulary of module, interface, seam, adapter, depth, leverage, and locality when proposing changes.

## Product Terms

- **Conversation**: the durable chat thread identified by a completion ID. Conversations may be remote, local-only, shared, branched, or parented to another conversation.
- **Message**: a normalised chat item with role, content or parts, optional reasoning, citations, tool calls, usage, model metadata, and generated artefact data.
- **Conversation mode**: metadata that changes how a conversation behaves, such as ordinary chat, council debate, sandbox task, recipe, or focused app workflow.
- **Model**: an available generation target from the model catalogue. The web app chooses models, and the backend resolves model/provider execution details.
- **Model benchmark cache**: persisted third-party benchmark, pricing, and performance data used to inform model routing and catalogue decisions without exposing upstream API keys to clients.
- **Provider capability**: a backend capability category such as chat, audio, speech, transcription, image, video, music, embedding, search, research, guardrails, realtime, messaging, or training.
- **Provider adapter**: a concrete backend implementation for a provider capability. Provider selection is a real seam because capabilities have multiple adapters.
- **Agent**: a configured assistant persona with optional tools, MCP servers, team role, model settings, and sharing metadata.
- **Tool**: a callable assistant function exposed through the backend, including retrieval, media, code, workflow, and delegation tools.
- **Dynamic app**: a reusable app-like response or workflow registered through backend app modules and consumed by the web app.
- **Assistant capability**: a product-level capability shown through app, recipe, connector, agent, or tool catalogues. Capabilities publish availability, launch method, execution mode, auth requirement, saved-state support, and tags while keeping their runtime-specific implementation separate.
- **Artefact**: generated output rendered beside or inside conversation UI, including code, HTML, SVG, image, and combined artefact views.
- **Memory**: user-owned retrieval context stored through backend memory repositories and embedding/vector modules.
- **Sandbox run**: an automated coding task executed by the sandbox Worker and streamed back as task events.
- **Training job**: a user-scoped model training request submitted through the API Worker and executed by the training Worker.
- **Metrics event**: Analytics Engine data surfaced through the API Worker and displayed by the metrics app.

## Workspace Map

- **`apps/app`** is the main React Router frontend. Route files under `src/pages` stay thin and compose feature modules from `src/components`, hooks from `src/hooks`, API clients from `src/lib/api`, domain helpers from `src/lib`, and persisted UI state from `src/state`.
- **`apps/api`** is the Hono backend Worker. `src/index.ts` owns global middleware, OpenAPI docs, route mounting, scheduled events, queue events, and Durable Object export. Route modules validate and orchestrate; non-trivial behaviour belongs in `src/services`, `src/lib`, or `src/repositories`.
- **`apps/sandbox-worker`** is the isolated coding-run Worker. It owns `/execute`, JWT and GitHub-token checks, Cloudflare Sandbox execution, task runner selection, cancellation, and SSE task events.
- **`apps/training`** is the internal training Worker. It owns authenticated job/deployment routes, provider execution, persisted training records, and event history.
- **`apps/metrics`** is a small React dashboard over the API Worker `/metrics` route.
- **`apps/mobile`** is the iOS client. It mirrors core conversation, model, auth, streaming, artefact, and tool concepts in Swift.
- **`packages/schemas`** is the shared contract module. It exports Zod schemas and inferred types used by the frontend, backend, sandbox Worker, and training Worker.
- **`packages/agent-core`** is the shared agent loop module. It exposes the decision loop, approval resolution, and action handlers used by sandbox-style agent execution.

## Key Seams

- **HTTP route seam**: `apps/api/src/lib/http/routeBuilder.ts` centralises route registration, OpenAPI metadata, Zod validation, auth requirements, and response wrapping. Route modules should call into deeper modules instead of owning business logic.
- **Request context seam**: `apps/api/src/lib/context/serviceContext.ts` provides request-scoped environment access, repositories, database wrapper, request cache, authenticated user checks, user settings, and logging.
- **Persistence seam**: `apps/api/src/repositories` owns D1 access. Repositories should hide SQL, row mapping, and storage errors behind domain-specific methods.
- **Provider capability seam**: `apps/api/src/lib/providers/library.ts` and `registry/ProviderRegistry.ts` resolve capability adapters lazily by category and provider name. New provider behaviour belongs behind the relevant capability registration.
- **Recipe connector adapter seam**: `apps/api/src/services/apps/connectors/connector-adapters.ts` registers recipe connector provider configs with their operation executors. Connector listing, auth setup, and operation execution should use this adapter registry so provider metadata, schema coverage, and executable operations stay aligned.
- **Recipe catalogue seam**: `apps/api/src/services/apps/recipes/catalog.ts` is the thin loader for static recipe definitions, derived category/filter exports, and catalogue validation. Add recipe definitions under `apps/api/src/services/apps/recipes/catalog/` by domain group, and keep setup/run prompt construction in `runtime.ts` rather than inside catalogue data files.
- **Provider hosted-tool seam**: provider utility modules such as `apps/api/src/lib/providers/utils/openaiResponsesTools.ts` own provider-native hosted tool shaping, including MCP, file search, code interpreter, tool search, and other Responses tools. Provider request body modules should compose these builders instead of embedding hosted-tool construction inline.
- **Model analysis seam**: `apps/api/src/services/model-analysis`, `ArtificialAnalysisRepository`, and the `artificial_analysis_*` task handlers own benchmark ingestion, cached D1 storage, derived scoring, and source attribution for model analysis data.
- **Chat stream contract seam**: `packages/schemas/src/chat-stream.ts` owns the shared SSE formatting, parsing, and frontend assembly contract for streamed assistant messages, reasoning, tool calls, and tool results. API emitters and frontend stream consumers should use this contract instead of maintaining parallel stream state machines.
- **Chat execution request seam**: `apps/api/src/lib/chat/core/execution-request.ts` owns the provider request and stream post-processing option shapes after validation, preparation, compaction, and context pruning. `ChatOrchestrator` should use this seam for single-model, streaming, and multi-model execution so tools, enabled tools, approved tools, delegation, recipe options, and memory-aware prepared state stay consistent.
- **Chat tool-step seam**: `apps/api/src/lib/chat/core/tool-step-runner.ts` owns non-streaming multi-step tool continuation. It persists assistant tool-call messages before tool results, decides whether a tool result can continue the loop, requests follow-up model steps, and returns step metadata plus aggregate usage for completion responses.
- **Memory policy seam**: `apps/api/src/lib/chat/memoryPolicy.ts` owns memory tool exposure, pro-plan/settings gating, and memory prompt context formatting. Request preparation and memory tool implementations should use this module instead of duplicating memory feature checks.
- **Agent completion seam**: `apps/api/src/services/agents/completion-request.ts` owns the request shape passed from configured agents into the shared chat completion flow, including agent defaults, prompt injection, stream disabling, platform mapping, stop normalisation, and tool-choice adaptation. Agent route modules should not rebuild this request shape inline.
- **Agent provider I/O seam**: `apps/api/src/lib/chat/agent/provider-io.ts` owns provider-facing message projection, provider response interpretation, and tool-call round-tripping for agent mode. `runAgentLoop` should use this seam for provider I/O and keep its own implementation focused on loop orchestration, completion requirements, and tool execution.
- **Agent MCP seam**: `apps/api/src/services/agents/mcp-client.ts` owns agent MCP server parsing, connection readiness, wrapped tool naming, and callable tool schema extraction. Agent completion setup, server inspection routes, and MCP execution should use this module instead of duplicating MCP config or tool-name parsing.
- **Frontend data seam**: React Query hooks under `apps/app/src/hooks` coordinate remote API calls, local IndexedDB/localStorage fallback, optimistic cache updates, and polling. Components should consume hooks rather than duplicating fetch/cache logic.
- **Frontend HTTP seam**: `apps/app/src/lib/api/fetch-wrapper.ts` owns API base URL, credentials, CSRF headers, timeouts, JSON body handling, and API error parsing. Domain API clients should build on this wrapper.
- **Frontend authenticated configuration seam**: `apps/app/src/state/stores/chatStore.ts` owns the hydrated authenticated user, user settings, plan access, API-key presence, and settings-derived chat defaults. `useAuthStatus` bootstraps and mutates that snapshot, but settings-driven UI and message-sending decisions should read the store snapshot so they do not flash through unauthenticated or default states while `/auth/me` settles.
- **Assistant action catalogue seam**: `packages/schemas/src/assistant-actions.ts` owns the shared discovery and launch contract for assistant actions across installed recipes, dynamic apps, connectors, agents, and model tools. Frontend composer modules should consume catalogue items and execute their `launch` contract instead of branching on display kind or rebuilding URL/tool/recipe intent locally.
- **Assistant capability descriptor seam**: `packages/schemas/src/apps.ts` owns the shared `AssistantCapabilityDescriptor` contract used by app and recipe catalogues to expose product-level capability facts. Backend catalogue modules should attach descriptors through family-specific adapter modules, such as `apps/api/src/services/dynamic-apps/capabilities.ts` and `apps/api/src/services/apps/recipes/capabilities.ts`, while preserving separate runtimes for dynamic form execution and recipe workflows.
- **Frontend council turn seam**: `apps/app/src/lib/council-turns.ts` owns council speaker queues, synthetic debate/conclusion prompts, and council request options. `useChatManager` should use this seam for council turn planning and keep its own implementation focused on conversation cache updates, streaming, loading state, and title generation.
- **Frontend local conversation seam**: `apps/app/src/lib/local/local-chat-service.ts` owns IndexedDB with LocalStorage fallback for local-only conversations.
- **Realtime seam**: `apps/app/src/lib/realtime` owns WebRTC/WebSocket connection modules, while `apps/api/src/services/realtime` and provider capability modules create sessions and tokens.
- **Sandbox execution seam**: `apps/sandbox-worker/src/tasks` maps task profiles to task runners. `packages/agent-core` holds the reusable decision loop, while sandbox-worker modules adapt it to Cloudflare Sandbox and GitHub tasks.
- **Training provider seam**: `apps/training/src/providers/registry.ts` selects Bedrock or SageMaker adapters. `TrainingWorkerService` owns job/deployment orchestration and persistence through `TrainingStore`.

## Data Flow

- The web app initialises global providers in `root.tsx`, routes through `routes.ts`, and renders thin page modules that compose feature modules.
- Conversation UI flows through `ConversationPage`, `ConversationThread`, `useChatManager`, React Query hooks, Zustand stores, and `apiService`.
- Remote chat requests go through `ChatService.streamChatCompletions`, the API Worker `/chat/completions` route, backend completion modules, provider adapters, repositories, and streamed response events.
- Local-only chat requests use browser storage and optional WebLLM modules instead of backend persistence.
- Sandbox requests originate in the web app or GitHub webhook flow, are coordinated by API sandbox modules, then execute in `apps/sandbox-worker` with SSE progress.
- Training requests originate in the web app, are validated and authorised by the API Worker, then delegated to `apps/training` through an internal Worker interface.
- Metrics are written by backend analytics modules and read by `apps/metrics` through the API Worker `/metrics` route.
- The scheduled models.dev sync updates checked-in model configs, then calls the API admin task trigger. The API queues Artificial Analysis ingestion, stores the Free-tier language model data server-side, and schedules derived scoring one hour later.

## Architecture Review Defaults

- Treat route and page files as orchestration modules. If logic includes parsing, state machines, measurement, timers, retries, validation rules, or more than roughly 25-40 lines, move it behind a deeper module.
- Prefer existing shared seams before creating new ones: `routeBuilder`, `ServiceContext`, repositories, provider capability registrations, `fetch-wrapper`, React Query hooks, `localChatService`, shared schemas, and `agent-core`.
- Add generic frontend helpers under `apps/app/src/lib` or an existing subfolder, not inside pages or feature modules.
- Add generic backend helpers under `apps/api/src/lib` or `apps/api/src/utils`, and keep persistence logic in repositories.
- Build `@assistant/schemas` before validating consumers that import generated package output.
- Use focused workspace validation first, then broaden only when the change crosses multiple apps or packages.
