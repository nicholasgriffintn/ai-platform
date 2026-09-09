# @ngriffin_uk/polychat-schemas

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
