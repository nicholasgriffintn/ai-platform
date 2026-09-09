# @ngriffin_uk/polychat-component-conversation

## 1.0.1

### Patch Changes

- Updated dependencies [4789c96]
- Updated dependencies [4789c96]
- Updated dependencies [505ce6a]
- Updated dependencies [4789c96]
- Updated dependencies [505ce6a]
- Updated dependencies [34380a3]
- Updated dependencies [4789c96]
- Updated dependencies [4789c96]
- Updated dependencies [4789c96]
- Updated dependencies [4789c96]
  - @ngriffin_uk/polychat-library-react@0.3.0
  - @ngriffin_uk/polychat-schemas@1.1.0
  - @ngriffin_uk/polychat-component-ui@0.3.0
  - @ngriffin_uk/polychat-component-experiences@0.3.0
  - @ngriffin_uk/polychat-component-navigation@0.3.0
  - @ngriffin_uk/polychat-component-content@1.0.1
  - @ngriffin_uk/polychat-component-models@1.0.1

## 1.0.0

### Major Changes

- 7d3c809: Share one connected navigation shell between the web and desktop applications.

  `component-shell` is a new package holding the wiring layer that previously lived only in `apps/app`: the chat sidebar with its conversation list and menus, the product and conversation headers, the page and product shells, global search, the settings popover and the not-found page. It is the single exception to the router-, store- and client-free rule for `component-*` packages, because connecting the controlled presentation in `component-navigation` and `component-ui` to the stores and router is its whole job.

  What differs between hosts arrives through `ShellHostProvider`: the origin public share links point at, the dialogs a host owns alone, and the actions that open them. A host that has not migrated an action supplies one that throws, so a gap stays visible instead of becoming a control that quietly does nothing.

  `library-react` publishes `DISCOVER_PATH` alongside the existing place paths, and `library-client` publishes `WEB_APP_BASE_URL` so a host without a web origin can still build share links.

  `component-conversation` drops `ConversationHeader`. It was the desktop's stand-in for a real header and is replaced by the shared `ConversationProductHeader`.

- f440eb7: Retrieval becomes a tool the model calls. `search_documents` searches the user's own material and returns passages; the `use_rag` request flag, the composer toggle and the RAG settings panel are removed, along with the prompt augmentation that fired on every message whether or not the turn needed it.

  Memory recall splits cleanly: the synthesis stays in the prompt because it is short and always relevant, and per-turn similarity search gives way to `search_memories`, which the model calls when it needs a specific memory.

  Conversation titles are generated as post-turn server work and arrive on the stream, so a first turn no longer costs an extra client round trip. The client still titles conversations the server does not store.

- f440eb7: Second opinions run as a panel. A `second-opinion` skill holds the method and a `second_opinion` tool runs it over `runPanel`, with each reviewer answering on its own model and reading what earlier reviewers said.

  The client no longer builds the review prompt, detects the intent with a regex, or carries the request through message data. The message action sends a plain request and the model chooses the reviewers. `buildOpinionRequestPrompt`, `canRequestOpinionForMessage`, `getOpinionSourceContext`, `OpinionModelPicker` and the `renderOpinionSelector` prop are removed; `CouncilTurnView` becomes `PanelTurnView`, which both panels render through.

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

- e2ffadb: Add model-declared processing tiers and a Fast processing selector for compatible conversation models.
- d841b16: Add thread-scoped goals. A goal is a completion contract owned by a conversation or a sandbox run: it shapes the system prompt, survives turns, and only completes against an evidence ledger. Termination is behavioural — completed, blocked, stalled, or limit reached — with no iteration cap.
- bab4559: Add live stream activity metrics (elapsed time, streamed provider token usage, tool runs) to the streaming indicator, and a compact stats line under finished assistant responses.
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

### Patch Changes

- 34728e1: Establish the reusable React frontend package graph, host controls, shared contracts, runtime
  libraries, render modules, tooling presets, and publishable package interfaces.
- Updated dependencies [40048e2]
- Updated dependencies [588f262]
- Updated dependencies [ac5b12e]
- Updated dependencies [42c36ea]
- Updated dependencies [e2ffadb]
- Updated dependencies [34728e1]
- Updated dependencies [d841b16]
- Updated dependencies [bab4559]
- Updated dependencies [f5560d1]
- Updated dependencies [293b1ca]
- Updated dependencies [7d3c809]
- Updated dependencies [6334297]
- Updated dependencies [fc4ed91]
- Updated dependencies [f440eb7]
- Updated dependencies [0a2d695]
- Updated dependencies [1836aad]
- Updated dependencies [19573b8]
  - @ngriffin_uk/polychat-component-models@1.0.0
  - @ngriffin_uk/polychat-schemas@1.0.0
  - @ngriffin_uk/polychat-component-navigation@0.2.0
  - @ngriffin_uk/polychat-library-chat@1.0.0
  - @ngriffin_uk/polychat-component-ui@0.2.0
  - @ngriffin_uk/polychat-utility-core@0.2.0
  - @ngriffin_uk/polychat-library-client@0.2.0
  - @ngriffin_uk/polychat-library-react@0.2.0
  - @ngriffin_uk/polychat-component-content@1.0.0
  - @ngriffin_uk/polychat-component-experiences@0.2.0
  - @ngriffin_uk/polychat-library-realtime@0.1.1
  - @ngriffin_uk/polychat-utility-react@0.2.0
