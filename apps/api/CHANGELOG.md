# @assistant/api

## 1.1.0

### Minor Changes

- 6db7a00: Add the experimentation primitives. `library-flags` is an OpenFeature-shaped evaluation contract with a rules provider (deterministic bucketing from the targeting key, weighted splits, targeting, enable gates), a Cloudflare Flagship binding adapter and a layered provider that lets the dashboard override code. `ai-experiments` defines flags and experiments in code, assigns users with `feature_flag.evaluation` exposure events, runs work under an assignment, tracks outcomes with assignments attached, and runs offline variant sweeps with metrics. The API wires a per-request `Experiments` into the service context, tags AI generation telemetry with `experiment.<key>` properties, gates the flagged cron tasks through flags whose defaults come from the existing environment toggles, accepts an optional `FLAGS` Flagship binding, and serves `GET /flags/bootstrap`. Cron `enabledWhen` may now be asynchronous.
- 4968623: Add the sandbox primitives. `library-sandbox` collects the mechanisms the API, sandbox Worker and computer Worker each carried: the dynamic Worker evaluation template and content-addressed code ids, outbound policy with a virtual tools origin, lease fences, HMAC-signed grants, execution control with pause and cancel, output redaction and request helpers. `ai-sandbox` composes them over Cloudflare's Worker Loader into `createEvaluator`, the loopback `OutboundGateway` entrypoint and `createCodeMode`. The API gains the `run_code` tool (backed by the `LOADER` binding) that runs model-written JavaScript in a fresh isolate and routes `tools.<name>(args)` calls back through the function registry. The computer Worker now fences leases and signs screen grants through the library and reports stale leases by code; the sandbox Worker uses the shared execution control, cancellation and redaction, and verifies JWTs with `@ngriffin_uk/auth-jwt` instead of a hand-rolled HS256 check.
- dd4389b: Let the model edit a large artifact without rewriting it. An artifact tagged `mode="edit"` carries FIND/REPLACE blocks, and the API applies them to the latest version of that artifact when the turn finishes, storing and sending the full updated artifact. Each FIND must match exactly once. While a reply streams the thread shows that the artifact is updating, and an edit that cannot be applied is reported rather than rendered.
- 3c23660: When a teammate started from a Slack, Telegram or email thread hands work to a delegate, the follow-up it writes once that work reports back is now sent to the same thread. The sender mapping and binding are rechecked before sending, and each follow-up is delivered at most once.
- 462cbe7: Let the model search earlier conversations. `search_conversations` returns one excerpt per matching conversation with its title and date, scoped to the user's personal chats or, inside a project, to that project after an access check. It is on by default for signed-in chats. The unused, unescaped `MessageRepository.searchMessages` is replaced by the scoped query, and `excerptAround` joins the shared string helpers.
- d25fd94: Let people reach Polychat by email. A personal email binding is keyed by the address you write from, linked with the usual one-time command, and answered by threaded plain-text replies. Inbound mail arrives through the Worker email handler and is only accepted when a DKIM signature aligned with its From domain also covers the To or Cc header naming Polychat's inbox, so forged senders and replayed messages are refused. Auto-replies are ignored to avoid loops.
- 5ead2cc: Import GitHub and Linear issues into Work and review exact GitHub PR revisions manually or through signed automatic intake. Retain captured Sources and review Outputs, isolate each workspace and credential owner, and approve publication separately.

  Apply migration `0061_project_task_integrations` before deployment. Configure the GitHub webhook secret and pull-request events for automatic intake, and pull-request write permission for publication.

- dd4389b: Let React artifacts show live data and charts. An artifact can declare read-only connector reads in a leading `<bindings>` block and read them with `usePolychatData` from `@polychat/data`. The host runs each read through the API, which takes the declaration from the stored message, refuses operations that change anything, only lets a refetch change declared arguments, caches results for a minute and rate-limits each artifact. React artifacts now compile with Sucrase instead of Babel standalone, can import `recharts`, and are assembled without string replacement, so `$` sequences and `</script>` in component source no longer corrupt the page.
- c126d04: Add model governance to Work. Workspaces can search Hugging Face, import models and datasets pinned to a commit, and review static inspection evidence that never loads the weights. Approvals follow versioned policies with dry runs, exceptions and expiry. Suites can be compared across serving routes with confidence intervals, and fine-tunes run on Hugging Face Jobs from governed conversation snapshots with lineage and a compute record. Approved versions can be served on dedicated Inference Endpoints, drift is caught by nightly replays, and any route or version exports as a CycloneDX ML-BOM. Workspaces can enforce approved routes in project chats, and generations carry route and version tags. Each workspace connects its own Hugging Face account or organisation under Govern, with the platform token as an optional default, and retiring a deployed route deletes its endpoint. Training moves from Profile to Models › Build, and Hub staging for Bedrock imports is keyed by commit.
- 90f7110: Turn Work › Models into a model platform on the workspace's own provider accounts. Connect Hugging Face, AWS, Together, Fireworks, Nebius, Google Vertex, Azure AI Foundry, RunPod, Cloudflare Workers AI or any OpenAI-compatible endpoint, then upload weights or register them from a bucket, build governed datasets from files, the Hub, buckets, rated conversations or a teacher model, and train with supervised, preference, reinforcement, distillation, embedding, merge or quantise runs after comparing trainers on fit and cost. Deployments are sized and priced per host, serve through aliases with eval gates, canaries and rollback, and appear in chat as models. Governance adds per-action permissions with separation of duties, budgets with spend approval, idle pause, revocation across lineage, erasure requests, an audit trail and CycloneDX, SPDX, model card and training content exports.

  The personal Training app, the training Worker and `component-experiences/training` are removed, and the API now mounts the platform under `/model-platform`.

- 251ac59: Use remote MCP servers with any model. When MCP is enabled and the model has no hosted MCP tool, or a server's credential belongs to Polychat, the turn gets `mcp_list_tools` and `mcp_call_tool`, which call the server directly through a new Streamable HTTP client. Calls are classed as writes, so they follow the same approvals as other external writes, and only the tools a connection allows can run. MCP connections can now sign in with OAuth (discovery, dynamic client registration, PKCE and refresh) with tokens stored encrypted, and token connections can be kept for Polychat instead of OpenAI.
- 41bb6a8: Short skills can now apply themselves to the messages they help with. A skill marked `activation: per-message` (or saved with "apply automatically") is considered before each turn and, when it clearly fits, its instructions are added to that turn only, without a `load_skill` call. Selection has a 1.5 second deadline and never blocks the reply.
- 67b52ed: Give Poly an agenda. `GET /poly/agenda` derives what needs the person, what Poly is working on and what it finished this week from the Poly thread's delegations, goal and latest run, with no new storage. Poly's prompt carries the agenda each turn, the overlay shows it above the thread, and the sidebar's Ask Poly button shows Poly's status. The agenda refreshes on the live delegation, goal and run events for the Poly thread.
- 67b52ed: Let people reach Poly from their own chats. A personal Telegram or Slack binding pointed at Poly continues the Poly thread itself, with Poly's own tools and without navigation, and when a routine result interrupts, Poly also sends it to those bound chats through the idempotent outbound delivery record. Slack proactive messages post at the top of the conversation rather than into a thread.
- 67b52ed: Budget Poly's interruptions. Routines Poly sets up from its thread now report back to it, and each routine result passes through a judged, budgeted handoff before it reaches the person: results waiting on them always interrupt, failures and results a decision policy rates as urgent interrupt within five a day and thirty minutes apart, and everything else is noted quietly. Each occurrence is decided once and recorded as a `poly.handoffs` activity on the Poly thread, and the agenda, Poly's prompt and the overlay list what was noted and why.
- ee31a6d: Make Poly a platform teammate with one continuous thread per person. `POLY_TEAMMATE` is synced like the other platform teammates but kept out of rosters, `GET /poly/home` opens the person's Poly context and its `poly` home conversation, and the overlay always opens that thread through the Poly teammate. Poly runs only in its owner's thread, a Poly thread only runs as Poly, and navigation tools are offered only on turns the person started.
- 67b52ed: Let people approve a Poly write once and for all, for one destination. When Poly at the assistant level waits on a write with a known destination, the approval card offers "Always allow here". The server derives the tool and destination from the stored pending call and keeps the approval on the Poly context for thirty days, where a Cedar condition lets matching writes run unattended. Sends, spending, deletes, credentials and exports still ask every time. Approvals are listed in Poly's autonomy menu and can be revoked there.
- ee31a6d: Let Poly do things in its thread. Poly's grants now cover delegation, goals, memory, research, documents, notes, skills and automations alongside navigation, its thread uses the standard chat prompt with its persona and memory, and `buildStandardChatPrompt` takes a `poly` option that adds Poly's behaviour and the person's current place. `buildPolyPrompt` is removed.
- 6966643: Grant selected actions from existing connectors directly to projects through Plugins, without creating a recipe. Reuse personal accounts, the connector catalogue, project capabilities and existing execution approvals. Preserve exclusions and narrower recipe permissions.
- 462cbe7: Queue follow-ups while a Chat reply is running. The composer stays open during a reply and queues what you type, up to ten messages per conversation, listed above the composer and removable. Queued messages are held as suspended `queued_chat_message` tasks and the next one is released when the run ends, so they send in order even after the tab closes. Work keeps steering the run instead.
- e4ba666: Start a recipe from any service with a private webhook URL. Each webhook can carry an "only run when" condition, can be paused, rotated or deleted, and honours an Idempotency-Key header so retries do not run twice. Payloads reach the recipe as untrusted data and never carry authority. Composio and webhook events now share one admission path.
- 6e76041: Resume delegations whose run was interrupted instead of failing them. Tool calls left without a result are settled first: reads may run again, anything else is reported as of unknown outcome so it is never repeated automatically. A delegation resumes at most twice, before its deadline, within the steps and credit it has left.
- 77a5ee5: Shared conversation links now stop at the moment you shared them. Messages sent afterwards stay private until you choose Update link, and stopping sharing retires the link so sharing again issues a new one. Public reads are sent with no-store, no-referrer and noindex headers.
- 57f8a16: Add Sites, a generative site builder that works from one brief. Jev classifies the brief into a plan (kind, scope, tone, palette, model tier), a tier-selected coding model streams the site as JSON Patch lines against a guardrailed component catalogue, and the shell renders every patch the moment it lands. `library-sites` holds the catalogue, patch stream compiler, validator and repair, prompt assembly, theme tokens and a deterministic Next.js and Tailwind code generator; `component-sites` holds the live React registry, themed preview and code view. Sites persist as revisioned outputs, refine in follow-ups, export as runnable project files, and hand off to a project's sandbox for a full build. The SSE buffer parser now lives once in `utility-core`. Sites are interactive (state, bindings, visibility, repeat, filters and actions in both the live renderer and the generated code), editable in place through an element inspector with zero-token edits and scoped refinement, exportable straight to a pull request with generated images, embeddable in chat through the `build_site` tool, revisioned with restore and public preview links, and judged by Jev at planning, refinement, quality-scoring and prompt-evaluation time.
- 07290f2: Add a teammate autonomy dial. A teammate context can be an observer, an assistant or a partner, enforced by Cedar over each call's effect class: observers only read and draft, assistants ask before writes, partners write within their grants, and sends, spending, deletes, credentials and exports always ask. Poly starts as an assistant and its overlay can change the level. Run triggers now reach tool availability and execution, so Poly's navigation gate holds there too.
- c026725: Add the Waiting on You recipe. It checks connected GitHub, Linear, Slack and Gmail accounts for reviews, assigned work, mentions, threads and emails that are waiting for your reply, ranks them by who is blocked, and suggests one next step for each without changing anything. Run on a schedule by the Poly, urgent items reach you through its usual handoff budget.

### Patch Changes

- ece96c4: Add the billing and telemetry primitives. `ai-billing` holds turn estimates, credit state, rate-card pricing, provider billable units, subscription entitlement, price drift detection, and the usage engine (ledger, credit admission, reservations, plan allowances, infrastructure and capability metering) behind a `UsageStore` contract the API implements over its repositories. `ai-telemetry` holds the logger, a `Telemetry` facade over Analytics Engine, PostHog, beacon and OTLP sinks, AI generation and training-example capture, and token usage helpers. The API takes its logger, metrics recorder and training-example capture from this package, and its `lib/` tree now holds only host infrastructure with every capability under `services/`.
- ece96c4: Move the model catalogue and model policy out of the API. `library-model-catalogue` owns the models.dev data, its schema and the sync script, and `ai-models` owns lookups, tier and lineup resolution, credential authority, reasoning and verbosity rules. The API loads models from these packages and the `sync-models-dev` workflow runs from the catalogue package.
- ece96c4: Add the AI function, agent, tool, workflow and task primitives. `ai-functions` exposes task-shaped calls (`generateText`, `generateObject`, `classify`, `extract`, media and retrieval) over a provider runtime. `ai-agents` builds `Agent` on the decision loop and tool catalogues, and replaces `agent-core` in every host. `library-tools` replaces `library-tool-runtime` and the tool registry schema with definitions, catalogues, validation and execution. `library-tasks` adds outcome settlement, execution leases, handler registries, polling and cron schedules and status machines, and `ai-workflows` wraps them in `on`/`poll`/`every` so the API declares queued tasks, self-rescheduling pollers (now with an attempt cap) and cron jobs in one registry.
- 33133cc: Centralise every authored prompt in a catalogue and a retrieval package. `library-prompts-catalogue` holds all prompt text and fragments as data with a validating schema, variables and conditionals; `ai-prompts` retrieves entries by id, task or variant, renders `{{variable}}` templates, and composes the chat, meta-assistant, sandbox, memory, document, agent, sandbox-worker, provider and panel prompts. Hardcoded prompts are removed from `ai-providers` (image styles and guardrail policies), `ai-functions` (task system prompts), `ai-agents`, `schemas` (council member prompts, teammate and platform teammate briefs) and the API and sandbox worker services, which now source their text from the catalogue.
- ece96c4: Add the provider primitives package and move every provider implementation into it. `ProviderLibrary` owns categorised bootstrapping, alias and lifecycle resolution, per-category decorators, and host error mapping, and providers receive a `ProviderRuntime` (`ProviderHost` plus a resolver for sibling providers) instead of importing host modules. Platform credential detection, user-versus-platform API key resolution, and provider fallback move there from the API. `utility-server` holds the server helpers those providers share, and the API and sandbox Workers resolve providers through the library.
- 33133cc: Move the built-in Agent Skills into a catalogue package. `library-skills-catalogue` owns the SKILL.md documents and resources, the frontmatter schema, document parsing and the `SkillCatalog` resolver; `ai-skills` adds retrieval, resource reads and the `<skill_content>` / `<skill_resource>` formatting. The API keeps authored-skill persistence, availability and scope, and reads built-in skills and formatting from the packages.
- b4c0c65: Add user feedback capture to telemetry. `captureAiFeedback` fans thumbs feedback out to a new AI Gateway sink that patches the stored log (when the message has a log id) and to PostHog as a survey response linked to the chat run trace that produced the message. Provider generation events now use the chat run as `$ai_trace_id` (falling back to the conversation) so feedback and generations link in AI Observability. The chat feedback endpoint accepts a `message_id`, resolves the message, run id, log id and trace id on the backend, and attributes feedback to the latest assistant message when clients send only the conversation. The frontend sends the message id and always shows feedback prompts on assistant messages.
- 462cbe7: Settle dead chat runs without waiting for someone to open them. A scheduled sweep reconciles running or cancelling runs whose thread lease has lapsed, and streamed text is checkpointed on the run so an interrupted turn keeps its partial reply as a stopped message instead of losing it.
- 8c4ed1e: Move Composio and the connector provider abstraction out of the API. `library-composio` owns the configured toolkit catalogue, its schema, the session handle contract and the `composio:sync` script, and `ai-integrations` owns the connector provider registry, operation and approval policy, write-outcome classification, API-key executors, the Composio REST and trigger clients, and the Pashi contract, catalogue and client. The API keeps connection authority, approvals, the private file bridge, run lifecycle, persistence and the function tool surfaces, and consumes both packages through `ai-integrations`.
- b105d00: Paginate flagged dataset rows correctly and preserve remaining warnings when excluding rows. Recalculate revision statistics, reject invalid indexes, reuse repeated exclusions, and recover partial saves without duplicating files.

  Preserve selections after failed actions, open the resulting revision after success, and show dataset loading errors. Fail missing upload previews promptly and cancel source streams when previews stop early.

  Associate switch labels and descriptions automatically when no explicit control ID is supplied.

- 462cbe7: Stop saving blank assistant replies. When a model finishes a step with no visible text and no tool calls, the agent loop retries the request once, then asks for a tool-free answer from what the conversation already holds, and finally writes a plain notice if both come back empty. Every attempt's usage is billed with the turn, and empty replies are logged as `empty_model_response`.
- 0c9087c: Count unread task notifications across the whole inbox. `unread` used to be counted from the returned page only, which is at most 50 rows by default, so it stopped at the page size. `TaskNotificationRepository.countUnreadInbox` now counts over the same filter `listInbox` uses, so "N unread" labels and the Attention badges show the real total.
- b105d00: Require budget checks and approval for deployment resumes and scale increases. Wait for provider provisioning and deletion to finish before marking dedicated deployments deleted, and expose unsupported pause controls in host capabilities.

  Claim the paid continuation after a Together upload so concurrent polls cannot create duplicate endpoints. Preserve uncertain continuation outcomes for reconciliation.

  Preserve input withdrawals on completed training outputs and check current route approval for Chat and custom evaluation judges. Pass validation data to embedding training and run GGUF conversion with checked argument lists.

- b105d00: Verify every published upload file before inspection, including files without Hub hashes, and mark failed publications accurately. Respect pause and delete requests before provisioning, schedule resumed deployments, and calculate idle time from usage and resume events instead of background polling. Validate dataset byte ranges and restrict credentials during redirected downloads.

  Keep route revocations in force until explicit re-approval, record withdrawals for automatically allowed models, and retire affected routes during erasure without revoking the clean dataset revision.

- b105d00: Expose approved workspace aliases in Chat, resolve each alias once per request, and enforce workspace membership, current approval and deployment availability. Apply promotion checks to initial targets and rollbacks, and create deployment aliases without a target until explicitly promoted.

  Claim spend approvals before execution to prevent duplicate starts. Add executing and failed request states, enforce separate approval when configured, and recheck budgets before starting approved work.

  Preserve multipart upload progress under concurrent requests and order alias approval events reliably when timestamps tie. Keep internal evaluation and synthetic dataset calls scoped to their workspace deployment.

- b105d00: Claim provider creation atomically to prevent duplicate training jobs and deployments. Preserve cancellation requests during submission, expose the cancelling state, and register jobs that finish immediately. Recheck model approval before creation and require reconciliation for interrupted provider requests.

  Settle hosting intervals and replace training costs atomically, and preserve accrued costs when pausing, scaling or deleting a deployment. Apply migration 0055 before deploying the API.

- ee31a6d: Call the Poly by its name everywhere. The `meta` conversation type is now `poly`, the `meta_assistant` request field is now `poly`, and the meta assistant contracts, prompts, tools, hooks and overlay are renamed to match (`POLY_NAVIGATION_TOOL_NAMES`, `polyRequestSchema`, `buildPolyPrompt`, `PolyOverlay`, `usePolyNavigation`). A data migration moves stored `meta` conversations to `poly`. Behaviour is unchanged.
- 169e2f5: Add the Polychat CLI, which pairs a terminal, server or gateway through a device code instead of a pasted API key, and show it on the downloads page. The device approval page now shows the code as cells, the requesting client, its expiry and what approval grants. Device sign-in clients no longer trip bot detection when they start and poll.
- 1e5cafb: Let `ask_user` ask for a file. A question can set `requestsFile`, the question card offers an "Attach a file" button for it, and the chosen files are uploaded with the same model rules as composer attachments and sent with the answers.
- cb9ddcc: Declare what each tool changes. `TOOL_EFFECT_CLASSES` names eight effect classes, `ToolDefinition.effects` declares a tool's class and destination, and `resolveToolEffectClass` treats an undeclared tool as a write. The API's built-in catalogue now refuses a tool without effects, and `call_api` and `use_recipe_connector` classify each call from its input.
- Updated dependencies [ece96c4]
- Updated dependencies [6db7a00]
- Updated dependencies [ece96c4]
- Updated dependencies [ece96c4]
- Updated dependencies [33133cc]
- Updated dependencies [ece96c4]
- Updated dependencies [4968623]
- Updated dependencies [33133cc]
- Updated dependencies [b4c0c65]
- Updated dependencies [dd4389b]
- Updated dependencies [d3f1df3]
- Updated dependencies [297b848]
- Updated dependencies [3c23660]
- Updated dependencies [8c4ed1e]
- Updated dependencies [462cbe7]
- Updated dependencies [b105d00]
- Updated dependencies [d25fd94]
- Updated dependencies [5ead2cc]
- Updated dependencies [dd4389b]
- Updated dependencies [462cbe7]
- Updated dependencies [b105d00]
- Updated dependencies [c126d04]
- Updated dependencies [b105d00]
- Updated dependencies [b105d00]
- Updated dependencies [90f7110]
- Updated dependencies [b105d00]
- Updated dependencies [251ac59]
- Updated dependencies [41bb6a8]
- Updated dependencies [67b52ed]
- Updated dependencies [67b52ed]
- Updated dependencies [ee31a6d]
- Updated dependencies [ee31a6d]
- Updated dependencies [67b52ed]
- Updated dependencies [ee31a6d]
- Updated dependencies [169e2f5]
- Updated dependencies [6966643]
- Updated dependencies [1e5cafb]
- Updated dependencies [462cbe7]
- Updated dependencies [e4ba666]
- Updated dependencies [1df361b]
- Updated dependencies [6e76041]
- Updated dependencies [b105d00]
- Updated dependencies [d3f1df3]
- Updated dependencies [57f8a16]
- Updated dependencies [07290f2]
- Updated dependencies [cb9ddcc]
  - @ngriffin_uk/polychat-ai-billing@0.2.0
  - @ngriffin_uk/polychat-ai-telemetry@0.2.0
  - @ngriffin_uk/polychat-ai-experiments@0.2.0
  - @ngriffin_uk/polychat-library-flags@0.2.0
  - @ngriffin_uk/polychat-ai-providers@0.2.0
  - @ngriffin_uk/polychat-ai-workflows@0.2.0
  - @ngriffin_uk/polychat-schemas@1.2.0
  - @ngriffin_uk/polychat-ai-models@0.2.0
  - @ngriffin_uk/polychat-ai-functions@0.2.0
  - @ngriffin_uk/polychat-ai-agents@0.2.0
  - @ngriffin_uk/polychat-library-tools@0.3.0
  - @ngriffin_uk/polychat-library-tasks@0.2.0
  - @ngriffin_uk/polychat-ai-prompts@0.2.0
  - @ngriffin_uk/polychat-utility-server@0.2.0
  - @ngriffin_uk/polychat-library-registry@0.3.0
  - @ngriffin_uk/polychat-ai-sandbox@0.2.0
  - @ngriffin_uk/polychat-library-sandbox@0.2.0
  - @ngriffin_uk/polychat-utility-core@0.3.0
  - @ngriffin_uk/polychat-library-skills-catalogue@0.2.0
  - @ngriffin_uk/polychat-ai-skills@0.2.0
  - @ngriffin_uk/polychat-library-chat@1.1.0
  - @ngriffin_uk/polychat-ai-integrations@0.2.0
  - @ngriffin_uk/polychat-ai-model-providers@0.2.0
  - @ngriffin_uk/polychat-library-model-registry@0.2.0
  - @ngriffin_uk/polychat-library-policy@0.2.0
  - @ngriffin_uk/polychat-library-sites@0.2.0
  - @ngriffin_uk/polychat-library-goals@0.1.1
  - @ngriffin_uk/polychat-library-interactions@0.1.1

## 1.0.0

### Major Changes

- f440eb7: Collapse the seven sandbox tools into one `run_sandbox_task` with a `taskType` argument, and add a `sandbox-tasks` skill covering how to pick the type and write a task an unattended run can complete. `run_feature_implementation`, `run_code_review`, `run_test_suite`, `run_bug_fix`, `run_refactoring`, `run_documentation` and `run_migration` are removed.
- f440eb7: Retrieval becomes a tool the model calls. `search_documents` searches the user's own material and returns passages; the `use_rag` request flag, the composer toggle and the RAG settings panel are removed, along with the prompt augmentation that fired on every message whether or not the turn needed it.

  Memory recall splits cleanly: the synthesis stays in the prompt because it is short and always relevant, and per-turn similarity search gives way to `search_memories`, which the model calls when it needs a specific memory.

  Conversation titles are generated as post-turn server work and arrive on the stream, so a first turn no longer costs an extra client round trip. The client still titles conversations the server does not store.

### Minor Changes

- f440eb7: Saved agents now run on the platform prompt. An agent's instructions and few-shot examples become a persona layered into the generated system prompt, so an agent conversation gets safety standards, the skills roster, memory, formatting, channel context and model metadata instead of the agent's own text alone.

  The coding prompt collapses into the standard assembler, which fixes a coding model in agent mode receiving no agent guidelines and a coding model on SMS receiving no channel context.

- 42c36ea: Release the applications from changesets. Merging a changeset that names an application versions it, tags it and publishes a GitHub release with its changelog entry; the desktop release also carries macOS, Windows and Linux archives built on their own runners. The API serves those archives from `/desktop/downloads` and answers the desktop updater from `/desktop/releases`, so neither the website nor the application needs to know where the builds are hosted.
- f440eb7: Run every chat turn through one engine. Streaming and buffered requests now differ only in the transport they hand to the agent loop, so the step budget, tool execution, persistence, usage limits and the goal contract are resolved in one place instead of three.

  Streaming agent turns are now gated by the active goal, which the streaming path previously skipped. Ordinary chat gets the chat mode step budget rather than a single tool round. Memory is classified once per run rather than once per turn, and no longer suppresses goal continuation.

- f440eb7: Second opinions run as a panel. A `second-opinion` skill holds the method and a `second_opinion` tool runs it over `runPanel`, with each reviewer answering on its own model and reading what earlier reviewers said.

  The client no longer builds the review prompt, detects the intent with a regex, or carries the request through message data. The message action sends a plain request and the model chooses the reviewers. `buildOpinionRequestPrompt`, `canRequestOpinionForMessage`, `getOpinionSourceContext`, `OpinionModelPicker` and the `renderOpinionSelector` prop are removed; `CouncilTurnView` becomes `PanelTurnView`, which both panels render through.

### Patch Changes

- f440eb7: `lib/prompts` is the chat system prompt and nothing else. The article, web-search, extract-content and drawing prompts move to the services whose routes they back.

  The prompt no longer compacts itself on small-context models. ADR 0032 found that compact variants drop exactly the detail that prevents a broken result, and the same mechanism was still trimming the principles and metadata sections.

- Updated dependencies [40048e2]
- Updated dependencies [588f262]
- Updated dependencies [ac5b12e]
- Updated dependencies [42c36ea]
- Updated dependencies [e2ffadb]
- Updated dependencies [34728e1]
- Updated dependencies [d841b16]
- Updated dependencies [d841b16]
- Updated dependencies [293b1ca]
- Updated dependencies [f440eb7]
- Updated dependencies [6334297]
- Updated dependencies [fc4ed91]
- Updated dependencies [0a2d695]
- Updated dependencies [2c14529]
- Updated dependencies [1836aad]
- Updated dependencies [19573b8]
  - @ngriffin_uk/polychat-schemas@1.0.0
  - @ngriffin_uk/polychat-utility-core@0.2.0
  - @ngriffin_uk/polychat-library-agent-core@0.2.0
  - @ngriffin_uk/polychat-library-tool-runtime@0.2.0
  - @ngriffin_uk/polychat-library-registry@0.2.0
