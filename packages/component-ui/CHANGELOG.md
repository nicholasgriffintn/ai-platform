# @ngriffin_uk/polychat-component-ui

## 0.3.0

### Minor Changes

- 505ce6a: Give the desktop window every page the web application serves.

  The desktop had the Chat places and nothing else. Work went nowhere, because its connected containers lived in `apps/app` where only the web could reach them, and the same was true of the conversation home, Profile, Models, Discover, Pets, Pricing and the legal pages. The mode toggle, the Discover section and the settings popover all linked to routes the window answered with a 404.

  - The connected Work containers, the conversation home, Profile, Models, Discover, Pets, Pricing and the legal pages moved into `component-shell` beside the Chat places they already shared. `WorkPlaceShell` is the Work frame, reading the workspace and project from the route the way `ChatPlaceShell` reads the Chat place.
  - The desktop registers a page directory for each of them, so every link either host renders now resolves in both.
  - Ask Poly and the project picker moved into a shared `ShellDialogs` the desktop mounts through `ShellHostProvider`, and the desktop drops the throwing placeholder it used for Ask Poly.
  - The desktop wraps its routes in the shared error page, so a render failure explains itself instead of leaving a blank window.
  - `polychat://` links reach Work, Profile and Discover as well as Chat, which is what the attention notifications the window already raises point at.
  - The window title names the open place rather than staying "Polychat".
  - House fonts and built-in pet sheets ship inside `component-ui` and resolve through each host's bundler, replacing the static `/fonts` and `/pets` directory the desktop reached by symlink.

### Patch Changes

- 34380a3: Fix the defects a review of the desktop and web shells turned up.

  **The desktop window could white-screen instead of showing its error page.** `getCurrentWindow()` reads `window.__TAURI_INTERNALS__` synchronously, so it throws outright wherever the renderer runs without the Tauri host — `dev:renderer`, for one. The window-title effect called it on every navigation, and it ran in `DesktopShellHost`, one level _above_ the error boundary, so nothing caught it and no exception was reported. The native title is now set only when the Tauri runtime is present, and the window's own effects moved inside the boundary alongside the routes.

  **The error page trapped the window on it.** `AppErrorBoundary` never cleared its error, so "Back to the nest" changed the URL and kept rendering the same error. It now resets when the location changes.

  **A pet sheet url could resolve to an inherited property.** `resolvePetSheetUrl` looked the url up on a plain object, so an account whose sheet url was `constructor` or `toString` got a function stringified into `background-image`. It reads from a `Map` now.

  **The Work sidebar re-rendered on every streamed token in the app.** It subscribed to the whole `streams` map, which every stream mutator replaces, so each token re-ran its conversation grouping and rebuilt the sidebar. It now watches only the statuses of the conversations it lists.

  **A project conversation rebuilt its whole thread config on every render.** The `modeConfig` handed to the thread was an inline literal, and `useFileMessageAsTask` returned a fresh object each render, so `requestOptions` changed identity on every streamed chunk and tore down the chat manager's callbacks with it. Both are memoised, so the config is stable while a response streams.

  **The conversation home rebuilt its mode config needlessly, and missed an entitlement change.** `HomePage`'s host/chat merge is memoised, and `useHomeChatModeConfig` now lists `isPro`, which it reads to decide which composer commands to offer but had omitted from its dependencies.

  **The desktop rebuilt its whole place shell on every navigation.** Each page wrapped itself in `ChatPlaceShell` or `WorkPlaceShell`, so moving between two pages of the same place unmounted the sidebar and, in Work, the workspace and project context with it — where the web keeps them mounted through a layout route. A page now declares which place it belongs to and the desktop router mounts that shell once around the group.

  **Notification delivery is chosen by a component rather than a hook passed as a value.** `ShellHost` carried `useTaskNotificationChannel`, a hook stored on an object and called dynamically, which the linter flagged as unverifiable. Each host now supplies a `TaskNotificationSettings` component bound to its own channel, matching how `HostDialogs` already works.

  **The desktop announced attention on every poll.** The attention query returns a fresh array every 15 seconds, so the window sent the whole list to its Rust core each time and relied on the ledger there to stay quiet. It now skips the call when the set of waiting items has not changed, keyed by account so switching accounts still announces.

- Updated dependencies [4789c96]
- Updated dependencies [4789c96]
- Updated dependencies [4789c96]
- Updated dependencies [505ce6a]
- Updated dependencies [34380a3]
- Updated dependencies [4789c96]
- Updated dependencies [4789c96]
  - @ngriffin_uk/polychat-library-react@0.3.0
  - @ngriffin_uk/polychat-schemas@1.1.0

## 0.2.0

### Minor Changes

- ac5b12e: Replace the conversation list's stacked selects with a nested options menu, and extend what it can filter.

  `component-ui` gains `OptionsMenu`, a submenu-per-setting menu whose rows carry their current value and check the selected option. `ConversationListControls` now takes a single `filters` object plus `onFiltersChange` and `onReset` instead of one prop pair per setting, and adds a last-activity window and a grouping choice alongside status and sort. `ConversationGroup` requires an `id` and treats `title` as optional so an ungrouped list renders without headings.

  `schemas` publishes `conversationArchiveFilterSchema`, `conversationSortBySchema`, and `conversationActivityWindowSchema`. The activity window is resolved to an absolute cutoff by whoever owns the calendar: `conversationActivityCutoff` returns the local start-of-day boundary, and clients send it as an `updated_after` timestamp rather than asking the API to interpret a symbolic window. `filterConversationsByListOptions` applies the same cutoff to device-local conversations, honours the new title sort, and accepts an explicit `now`.

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
- Updated dependencies [7d3c809]
- Updated dependencies [6334297]
- Updated dependencies [fc4ed91]
- Updated dependencies [f440eb7]
- Updated dependencies [0a2d695]
- Updated dependencies [1836aad]
- Updated dependencies [19573b8]
  - @ngriffin_uk/polychat-schemas@1.0.0
  - @ngriffin_uk/polychat-library-chat@1.0.0
  - @ngriffin_uk/polychat-utility-core@0.2.0
  - @ngriffin_uk/polychat-library-react@0.2.0
  - @ngriffin_uk/polychat-utility-react@0.2.0
