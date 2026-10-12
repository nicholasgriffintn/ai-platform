# @ngriffin_uk/polychat-schemas

## 1.2.0

### Minor Changes

- ece96c4: Add the AI function, agent, tool, workflow and task primitives. `ai-functions` exposes task-shaped calls (`generateText`, `generateObject`, `classify`, `extract`, media and retrieval) over a provider runtime. `ai-agents` builds `Agent` on the decision loop and tool catalogues, and replaces `agent-core` in every host. `library-tools` replaces `library-tool-runtime` and the tool registry schema with definitions, catalogues, validation and execution. `library-tasks` adds outcome settlement, execution leases, handler registries, polling and cron schedules and status machines, and `ai-workflows` wraps them in `on`/`poll`/`every` so the API declares queued tasks, self-rescheduling pollers (now with an attempt cap) and cron jobs in one registry.
- 33133cc: Centralise every authored prompt in a catalogue and a retrieval package. `library-prompts-catalogue` holds all prompt text and fragments as data with a validating schema, variables and conditionals; `ai-prompts` retrieves entries by id, task or variant, renders `{{variable}}` templates, and composes the chat, meta-assistant, sandbox, memory, document, agent, sandbox-worker, provider and panel prompts. Hardcoded prompts are removed from `ai-providers` (image styles and guardrail policies), `ai-functions` (task system prompts), `ai-agents`, `schemas` (council member prompts, teammate and platform teammate briefs) and the API and sandbox worker services, which now source their text from the catalogue.
- d3f1df3: Canvas is a place, not a mode toggle. Chat and Work sidebars link to it above Files; opening it in Work asks for a project first, like a new chat, and keeps what it makes with that project.
- 3c23660: When a teammate started from a Slack, Telegram or email thread hands work to a delegate, the follow-up it writes once that work reports back is now sent to the same thread. The sender mapping and binding are rechecked before sending, and each follow-up is delivered at most once.
- d25fd94: Let people reach Polychat by email. A personal email binding is keyed by the address you write from, linked with the usual one-time command, and answered by threaded plain-text replies. Inbound mail arrives through the Worker email handler and is only accepted when a DKIM signature aligned with its From domain also covers the To or Cc header naming Polychat's inbox, so forged senders and replayed messages are refused. Auto-replies are ignored to avoid loops.
- 5ead2cc: Import GitHub and Linear issues into Work and review exact GitHub PR revisions manually or through signed automatic intake. Retain captured Sources and review Outputs, isolate each workspace and credential owner, and approve publication separately.

  Apply migration `0061_project_task_integrations` before deployment. Configure the GitHub webhook secret and pull-request events for automatic intake, and pull-request write permission for publication.

- dd4389b: Let React artifacts show live data and charts. An artifact can declare read-only connector reads in a leading `<bindings>` block and read them with `usePolychatData` from `@polychat/data`. The host runs each read through the API, which takes the declaration from the stored message, refuses operations that change anything, only lets a refetch change declared arguments, caches results for a minute and rate-limits each artifact. React artifacts now compile with Sucrase instead of Babel standalone, can import `recharts`, and are assembled without string replacement, so `$` sequences and `</script>` in component source no longer corrupt the page.
- 462cbe7: Record how long providers keep API prompts and replies. Model configs gain an optional `dataRetention` block with the documented maximum days, how zero retention is reached (`default`, `account_setting` or `on_request`) and the policy URL. OpenAI, Azure OpenAI, Anthropic, Gemini API, Groq, Mistral and Bedrock carry their published defaults, and the model picker's hover preview shows them with a link to the policy.
- b105d00: Require budget checks and approval for deployment resumes and scale increases. Wait for provider provisioning and deletion to finish before marking dedicated deployments deleted, and expose unsupported pause controls in host capabilities.

  Claim the paid continuation after a Together upload so concurrent polls cannot create duplicate endpoints. Preserve uncertain continuation outcomes for reconciliation.

  Preserve input withdrawals on completed training outputs and check current route approval for Chat and custom evaluation judges. Pass validation data to embedding training and run GGUF conversion with checked argument lists.

- c126d04: Add model governance to Work. Workspaces can search Hugging Face, import models and datasets pinned to a commit, and review static inspection evidence that never loads the weights. Approvals follow versioned policies with dry runs, exceptions and expiry. Suites can be compared across serving routes with confidence intervals, and fine-tunes run on Hugging Face Jobs from governed conversation snapshots with lineage and a compute record. Approved versions can be served on dedicated Inference Endpoints, drift is caught by nightly replays, and any route or version exports as a CycloneDX ML-BOM. Workspaces can enforce approved routes in project chats, and generations carry route and version tags. Each workspace connects its own Hugging Face account or organisation under Govern, with the platform token as an optional default, and retiring a deployed route deletes its endpoint. Training moves from Profile to Models › Build, and Hub staging for Bedrock imports is keyed by commit.
- b105d00: Expose approved workspace aliases in Chat, resolve each alias once per request, and enforce workspace membership, current approval and deployment availability. Apply promotion checks to initial targets and rollbacks, and create deployment aliases without a target until explicitly promoted.

  Claim spend approvals before execution to prevent duplicate starts. Add executing and failed request states, enforce separate approval when configured, and recheck budgets before starting approved work.

  Preserve multipart upload progress under concurrent requests and order alias approval events reliably when timestamps tie. Keep internal evaluation and synthetic dataset calls scoped to their workspace deployment.

- 90f7110: Turn Work › Models into a model platform on the workspace's own provider accounts. Connect Hugging Face, AWS, Together, Fireworks, Nebius, Google Vertex, Azure AI Foundry, RunPod, Cloudflare Workers AI or any OpenAI-compatible endpoint, then upload weights or register them from a bucket, build governed datasets from files, the Hub, buckets, rated conversations or a teacher model, and train with supervised, preference, reinforcement, distillation, embedding, merge or quantise runs after comparing trainers on fit and cost. Deployments are sized and priced per host, serve through aliases with eval gates, canaries and rollback, and appear in chat as models. Governance adds per-action permissions with separation of duties, budgets with spend approval, idle pause, revocation across lineage, erasure requests, an audit trail and CycloneDX, SPDX, model card and training content exports.

  The personal Training app, the training Worker and `component-experiences/training` are removed, and the API now mounts the platform under `/model-platform`.

- b105d00: Claim provider creation atomically to prevent duplicate training jobs and deployments. Preserve cancellation requests during submission, expose the cancelling state, and register jobs that finish immediately. Recheck model approval before creation and require reconciliation for interrupted provider requests.

  Settle hosting intervals and replace training costs atomically, and preserve accrued costs when pausing, scaling or deleting a deployment. Apply migration 0055 before deploying the API.

- 251ac59: Use remote MCP servers with any model. When MCP is enabled and the model has no hosted MCP tool, or a server's credential belongs to Polychat, the turn gets `mcp_list_tools` and `mcp_call_tool`, which call the server directly through a new Streamable HTTP client. Calls are classed as writes, so they follow the same approvals as other external writes, and only the tools a connection allows can run. MCP connections can now sign in with OAuth (discovery, dynamic client registration, PKCE and refresh) with tokens stored encrypted, and token connections can be kept for Polychat instead of OpenAI.
- 41bb6a8: Short skills can now apply themselves to the messages they help with. A skill marked `activation: per-message` (or saved with "apply automatically") is considered before each turn and, when it clearly fits, its instructions are added to that turn only, without a `load_skill` call. Selection has a 1.5 second deadline and never blocks the reply.
- 67b52ed: Give Poly an agenda. `GET /poly/agenda` derives what needs the person, what Poly is working on and what it finished this week from the Poly thread's delegations, goal and latest run, with no new storage. Poly's prompt carries the agenda each turn, the overlay shows it above the thread, and the sidebar's Ask Poly button shows Poly's status. The agenda refreshes on the live delegation, goal and run events for the Poly thread.
- 67b52ed: Budget Poly's interruptions. Routines Poly sets up from its thread now report back to it, and each routine result passes through a judged, budgeted handoff before it reaches the person: results waiting on them always interrupt, failures and results a decision policy rates as urgent interrupt within five a day and thirty minutes apart, and everything else is noted quietly. Each occurrence is decided once and recorded as a `poly.handoffs` activity on the Poly thread, and the agenda, Poly's prompt and the overlay list what was noted and why.
- ee31a6d: Make Poly a platform teammate with one continuous thread per person. `POLY_TEAMMATE` is synced like the other platform teammates but kept out of rosters, `GET /poly/home` opens the person's Poly context and its `poly` home conversation, and the overlay always opens that thread through the Poly teammate. Poly runs only in its owner's thread, a Poly thread only runs as Poly, and navigation tools are offered only on turns the person started.
- ee31a6d: Call the Poly by its name everywhere. The `meta` conversation type is now `poly`, the `meta_assistant` request field is now `poly`, and the meta assistant contracts, prompts, tools, hooks and overlay are renamed to match (`POLY_NAVIGATION_TOOL_NAMES`, `polyRequestSchema`, `buildPolyPrompt`, `PolyOverlay`, `usePolyNavigation`). A data migration moves stored `meta` conversations to `poly`. Behaviour is unchanged.
- 67b52ed: Let people approve a Poly write once and for all, for one destination. When Poly at the assistant level waits on a write with a known destination, the approval card offers "Always allow here". The server derives the tool and destination from the stored pending call and keeps the approval on the Poly context for thirty days, where a Cedar condition lets matching writes run unattended. Sends, spending, deletes, credentials and exports still ask every time. Approvals are listed in Poly's autonomy menu and can be revoked there.
- ee31a6d: Let Poly do things in its thread. Poly's grants now cover delegation, goals, memory, research, documents, notes, skills and automations alongside navigation, its thread uses the standard chat prompt with its persona and memory, and `buildStandardChatPrompt` takes a `poly` option that adds Poly's behaviour and the person's current place. `buildPolyPrompt` is removed.
- 6966643: Grant selected actions from existing connectors directly to projects through Plugins, without creating a recipe. Reuse personal accounts, the connector catalogue, project capabilities and existing execution approvals. Preserve exclusions and narrower recipe permissions.
- 1e5cafb: Let `ask_user` ask for a file. A question can set `requestsFile`, the question card offers an "Attach a file" button for it, and the chosen files are uploaded with the same model rules as composer attachments and sent with the answers.
- 462cbe7: Queue follow-ups while a Chat reply is running. The composer stays open during a reply and queues what you type, up to ten messages per conversation, listed above the composer and removable. Queued messages are held as suspended `queued_chat_message` tasks and the next one is released when the run ends, so they send in order even after the tab closes. Work keeps steering the run instead.
- e4ba666: Start a recipe from any service with a private webhook URL. Each webhook can carry an "only run when" condition, can be paused, rotated or deleted, and honours an Idempotency-Key header so retries do not run twice. Payloads reach the recipe as untrusted data and never carry authority. Composio and webhook events now share one admission path.
- 6e76041: Resume delegations whose run was interrupted instead of failing them. Tool calls left without a result are settled first: reads may run again, anything else is reported as of unknown outcome so it is never repeated automatically. A delegation resumes at most twice, before its deadline, within the steps and credit it has left.
- d3f1df3: Automations leave the teammates library for their own Scheduled place. The Chat and Work sidebars link to it under Teammates, and the recipe cards, filters, schedule dialogs and deep links move with it.
- 57f8a16: Add Sites, a generative site builder that works from one brief. Jev classifies the brief into a plan (kind, scope, tone, palette, model tier), a tier-selected coding model streams the site as JSON Patch lines against a guardrailed component catalogue, and the shell renders every patch the moment it lands. `library-sites` holds the catalogue, patch stream compiler, validator and repair, prompt assembly, theme tokens and a deterministic Next.js and Tailwind code generator; `component-sites` holds the live React registry, themed preview and code view. Sites persist as revisioned outputs, refine in follow-ups, export as runnable project files, and hand off to a project's sandbox for a full build. The SSE buffer parser now lives once in `utility-core`. Sites are interactive (state, bindings, visibility, repeat, filters and actions in both the live renderer and the generated code), editable in place through an element inspector with zero-token edits and scoped refinement, exportable straight to a pull request with generated images, embeddable in chat through the `build_site` tool, revisioned with restore and public preview links, and judged by Jev at planning, refinement, quality-scoring and prompt-evaluation time.
- 07290f2: Add a teammate autonomy dial. A teammate context can be an observer, an assistant or a partner, enforced by Cedar over each call's effect class: observers only read and draft, assistants ask before writes, partners write within their grants, and sends, spending, deletes, credentials and exports always ask. Poly starts as an assistant and its overlay can change the level. Run triggers now reach tool availability and execution, so Poly's navigation gate holds there too.
- cb9ddcc: Declare what each tool changes. `TOOL_EFFECT_CLASSES` names eight effect classes, `ToolDefinition.effects` declares a tool's class and destination, and `resolveToolEffectClass` treats an undeclared tool as a write. The API's built-in catalogue now refuses a tool without effects, and `call_api` and `use_recipe_connector` classify each call from its input.

### Patch Changes

- 6db7a00: Add the experimentation primitives. `library-flags` is an OpenFeature-shaped evaluation contract with a rules provider (deterministic bucketing from the targeting key, weighted splits, targeting, enable gates), a Cloudflare Flagship binding adapter and a layered provider that lets the dashboard override code. `ai-experiments` defines flags and experiments in code, assigns users with `feature_flag.evaluation` exposure events, runs work under an assignment, tracks outcomes with assignments attached, and runs offline variant sweeps with metrics. The API wires a per-request `Experiments` into the service context, tags AI generation telemetry with `experiment.<key>` properties, gates the flagged cron tasks through flags whose defaults come from the existing environment toggles, accepts an optional `FLAGS` Flagship binding, and serves `GET /flags/bootstrap`. Cron `enabledWhen` may now be asynchronous.
- b4c0c65: Add user feedback capture to telemetry. `captureAiFeedback` fans thumbs feedback out to a new AI Gateway sink that patches the stored log (when the message has a log id) and to PostHog as a survey response linked to the chat run trace that produced the message. Provider generation events now use the chat run as `$ai_trace_id` (falling back to the conversation) so feedback and generations link in AI Observability. The chat feedback endpoint accepts a `message_id`, resolves the message, run id, log id and trace id on the backend, and attributes feedback to the latest assistant message when clients send only the conversation. The frontend sends the message id and always shows feedback prompts on assistant messages.
- 169e2f5: Add the Polychat CLI, which pairs a terminal, server or gateway through a device code instead of a pasted API key, and show it on the downloads page. The device approval page now shows the code as cells, the requesting client, its expiry and what approval grants. Device sign-in clients no longer trip bot detection when they start and poll.
- Updated dependencies [4968623]
- Updated dependencies [297b848]
- Updated dependencies [462cbe7]
- Updated dependencies [b105d00]
- Updated dependencies [c126d04]
- Updated dependencies [90f7110]
- Updated dependencies [1df361b]
- Updated dependencies [57f8a16]
  - @ngriffin_uk/polychat-utility-core@0.3.0

## 1.1.0

### Minor Changes

- 4789c96: Announce the desktop's notifications from the task inbox the iOS application already uses, rather than a poller of its own.

  The first pass built a parallel system: it polled Work Attention, decided for itself which kinds were worth announcing, and kept its own idea of what counted as unread. Polychat already has a task notification system — a server-side inbox with read receipts, dismissal, per-item deep links and per-category preferences — and the iOS client consumes it through `TaskNotificationManager`. The desktop now consumes the same one.

  - `library-react` publishes `useTaskInbox`, the inbox query with its read and dismiss receipts. The web application had no inbox hook at all; only iOS had one, in Swift.
  - `useTaskNotificationSettings` is separated out of `useTaskNotifications`, so a surface can read the account's preferences without dragging web push registration along.
  - `polychat-schemas` publishes `taskNotificationCategoryForAttentionKind` and `isTaskNotificationCategoryEnabled`, so a client gates announcements on exactly the categories the server gates push on, rather than a hand-written list.

  What stays device-local is only what has to be: whether _this_ machine has already put a given item on screen. Announcing is not reading — a notification shown on your Mac must not mark the item read for your phone — so the ledger stays in the desktop's own database while unread, categories and the item list all come from the server.

  The badge now shows the inbox's own unread count. Desktop notifications are not clickable: `tauri-plugin-notification` exposes action handling on mobile only, so acting on an item still means opening the window.

- 4789c96: Correct how the desktop window and the desktop host talk to the Polychat API.

  The window renewed its access token on a blind ten minute timer against a token the API mints for fifteen minutes and stops reissuing with five minutes left. A laptop that slept through a tick woke holding a token nobody would renew, and every request failed until the next tick happened to land. The host now reports `expiresIn` alongside the token, and the window renews from that lifetime and again whenever the window regains focus or the machine comes back online.

  The packaged content security policy also refused the API origin, so avatars, uploads and generated images never rendered in the packaged application even though the same markup worked on the web. `img-src`, `media-src` and `connect-src` now admit the API and the avatar hosts the account menu reads, and a test holds the packaged and development policies to that.

  Other corrections:

  - A run whose Rust command refused — an endpoint that is no longer configured, a runtime the egress rules will not reach — closed its event stream silently, leaving the composer waiting on a reply that never came. The bridge now reports the refusal as a failed run, and an event this version cannot parse fails the run rather than hanging it.
  - Pairing secrets saved against a model runtime were stored and never sent. Probing, model discovery and model runs now carry them, as agent runs already did.
  - A model or agent run could leave its identifier in the cancellation registry when the HTTP client refused to build, so a later run reusing that identifier started cancelled.
  - The window now refuses to start against an API origin the host was not built for, rather than signing in against one API and calling another.
  - A transport error from a request carrying a pairing secret or the session cookie was stringified straight into the message the window shows. Those failures are now described by what went wrong and which runtime it was, so a credential or an address cannot be repeated back through an error.

  `polychat-schemas` publishes `desktopSessionTokenSchema` for the host's token reply and `isSameOrigin` alongside the other navigation guards.

## 1.0.0

### Major Changes

- 0a2d695: Move prompt-shaped tooling into skills, and reserve function tools for real capability.

  Seven built-in skills replace features that were previously prompt behaviour in tool or prompt-mode
  form: `prompt-craft`, `tutoring`, `structured-reasoning`, `task-decomposition`, `council`,
  `hacker-news`, and `article-analysis`.

  Breaking changes:

  - `councilChatOptionsSchema`, `COUNCIL_APP_ID`, and the `@ngriffin_uk/polychat-schemas/council-data`
    subpath are removed. `councilMembers` and `councilMemberIds` remain on the package root.
  - `chatRequestOptions.council` is removed with no replacement, and the Home Council mode goes with
    it. Council is reached from ordinary chat through its skill and `/council` command.
  - `homeChatModeId` drops `council`.
  - `component-conversation` no longer exports `CouncilChatControls`, and messages no longer carry
    `data.council`; `library-chat` drops the matching message-data type.
  - `component-content` no longer exports `TutorView`.
  - `skillRequirement` gains `suggestedTools`, and `skillCategory` gains `Reasoning`.
  - Authored skill documents accept an optional `resources` array.

  Removed API surface: `POST /apps/prompt-coach`, `POST /apps/retrieval/tutor`, and the
  `prompt_coach`, `tutor`, `add_reasoning_step`, `compose_functions`, `if_then_else`,
  `parallel_execute`, `retry_with_backoff`, `fallback`, and `analyse_hacker_news` tools.

  Added: `run_council`, backed by a reusable panel primitive that debates a question turn by turn on
  the conversation's model, streaming each member's turn into the chat as it lands and letting each
  turn route to the next speaker until the chamber converges; and `get_hacker_news_stories`, which
  returns front-page data without an auxiliary-model pass.

  `select_council_members` raises a member picker in the conversation, pre-ticked with the members the
  model recommends, so the user convenes the council themselves.

  The composer now de-duplicates slash commands by name. A mode and a skill can share one — Council is
  both — and two identical `/` entries are indistinguishable to the person typing; the mode wins,
  because selecting it pins the skill anyway.

  `component-content` gains `CouncilTurnView` and `CouncilMemberPickerView`, and exports a shared
  `ToolInteractionHandler` type. Tool interactions gain a `submitPrompt` action alongside
  `useAsPrompt`, for views whose control is itself the decision.

### Minor Changes

- 40048e2: Add GPT-6 Astra model presentation and extend model and chat contracts for OpenAI prompt-cache controls, asynchronous tools, reasoning configuration updates, and long-context billing.
- 588f262: Add a conversation list actions menu that archives or restores everything matching the current filters.

  `component-navigation` gains `ConversationListActions`, a kebab menu that sits beside the filter control. It offers "Archive all (N)" on an active list and "Restore all (N)" on an archived one, and withholds the action under the mixed `all` status where the count would not describe what changes.

  `schemas` publishes `bulkArchiveChatCompletionsJsonSchema` for the new `PATCH /chat/completions` endpoint, which matches on the same title and activity filters as the list and only moves conversations that are not already in the requested state. `ConversationListPage` now carries `total`, so a count can describe the whole filtered set rather than the loaded page.

  `compareConversationsBySort` is exported so clients can order a list the same way the API does, rather than re-sorting by date and dropping the title sort.

- ac5b12e: Replace the conversation list's stacked selects with a nested options menu, and extend what it can filter.

  `component-ui` gains `OptionsMenu`, a submenu-per-setting menu whose rows carry their current value and check the selected option. `ConversationListControls` now takes a single `filters` object plus `onFiltersChange` and `onReset` instead of one prop pair per setting, and adds a last-activity window and a grouping choice alongside status and sort. `ConversationGroup` requires an `id` and treats `title` as optional so an ungrouped list renders without headings.

  `schemas` publishes `conversationArchiveFilterSchema`, `conversationSortBySchema`, and `conversationActivityWindowSchema`. The activity window is resolved to an absolute cutoff by whoever owns the calendar: `conversationActivityCutoff` returns the local start-of-day boundary, and clients send it as an `updated_after` timestamp rather than asking the API to interpret a symbolic window. `filterConversationsByListOptions` applies the same cutoff to device-local conversations, honours the new title sort, and accepts an explicit `now`.

- 42c36ea: Release the applications from changesets. Merging a changeset that names an application versions it, tags it and publishes a GitHub release with its changelog entry; the desktop release also carries macOS, Windows and Linux archives built on their own runners. The API serves those archives from `/desktop/downloads` and answers the desktop updater from `/desktop/releases`, so neither the website nor the application needs to know where the builds are hosted.
- e2ffadb: Add model-declared processing tiers and a Fast processing selector for compatible conversation models.
- d841b16: Add thread-scoped goals. A goal is a completion contract owned by a conversation or a sandbox run: it shapes the system prompt, survives turns, and only completes against an evidence ledger. Termination is behavioural — completed, blocked, stalled, or limit reached — with no iteration cap.
- 6334297: Move the shipped render implementations into their packages and replace the placeholder interfaces.

  Host seams added so render modules stay portable:

  - `component-ui` exposes `LinkProvider`, `Link`, and `NavLink`; hosts pass resolved hrefs and supply
    their own router.
  - `library-surface` defines `SurfaceAnalytics`, and `library-react` exposes `AnalyticsProvider` and
    `useAnalytics`, so render modules report events without knowing the provider.
  - `component-content` exposes `CustomResponseViewProvider`, so tool responses that need host data
    are registered by the application and unknown names fall back to the raw JSON view.

  Render ownership:

  - `component-ui`: page shell frame and header registry, page primitives, empty and sign-in states,
    loading spinner, page skeletons, and the file uploader presentation.
  - `component-models`: the provider icon registry and `ProviderGlyph`, Artificial Analysis panel,
    model options and lists, auto-router picker, hover preview, and the controlled selector trigger
    and panel.
  - `component-navigation`: sidebar parts, settings popover, theme and more-options menus,
    conversation list and controls, storage notice, and the search dialog.
  - `component-capabilities`: capability and app cards, experience grid, capability theme helpers,
    dynamic tool form, tool configuration dialog, tool result card, and the recipe card and dialogs.
  - `component-content`: generated response views, artefact classification, actions, callout, inline
    preview, document editor, and the sandboxed artefact renderers.
  - `component-conversation`: message content, actions, tool and function messages, citations,
    reasoning, search grounding, connector approval, agent trace, composer input and menus, council
    controls, keyboard shortcuts, and the welcome screen.
  - `component-account`: account sidebar shell, agent, team, connector, and provider views, the user
    settings form, and the provider and connector credential modals.
  - `component-workspaces`: workspace and project cards, member, invitation, governance, knowledge,
    coding environment, and activity views, Work sidebar navigation, and the create/invite dialogs.
  - `component-experiences`: article, note, and podcast presentation under `/content`; canvas and
    drawing under `/media`; the Strudel player under `/music` with the runtime as an optional peer;
    training panels and forms under `/training`.

  Shared behaviour moved below the render layer:

  - `schemas`: chat modes, model selection, region variants, provider display, token formatting,
    auto-router modes, reasoning helpers, recipe presentation, article report contracts, connector
    approval parsing, and model tool configuration parsing.
  - `library-chat`: the conversation message contract plus message, artefact, agent-trace, opinion,
    branching, compaction, speech, composer-command, and tool-result helpers, each on its own subpath.
  - `utility-core` gains `generateId`, `formatBytes`, and `getErrorMessage`; `utility-react` gains
    `useFileUpload` and `containsEventTarget`.

- fc4ed91: Add project task boards to Work. A task is a durable, project-scoped objective that carries its own conversation and goal, so work lives somewhere other than one person's scrollback. Board columns are the task's own lifecycle; a completed goal lands in review and only a person accepts it. Runs execute with the starting member's own connections, and everything waiting on a person aggregates into one attention list. Agents become a project capability so a flow stage can name one, with the agent's tools intersected with the project's rather than unioned.
- 1836aad: Give a project task the fields a work item needs: acceptance criteria as separate checkable items, an expected deliverable, context, constraints including tools withheld from the run, dependencies that gate a start, a per-task approval policy, priority and a due date. Enforced fields and descriptive ones are stated separately so neither is mistaken for the other.

### Patch Changes

- 34728e1: Establish the reusable React frontend package graph, host controls, shared contracts, runtime
  libraries, render modules, tooling presets, and publishable package interfaces.
- 19573b8: Document the normalised token usage fields returned on chat completion responses.
- Updated dependencies [42c36ea]
- Updated dependencies [34728e1]
- Updated dependencies [6334297]
  - @ngriffin_uk/polychat-utility-core@0.2.0
