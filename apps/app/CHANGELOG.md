# @assistant/app

## 0.3.0

### Minor Changes

- d3f1df3: Canvas is a place, not a mode toggle. Chat and Work sidebars link to it above Files; opening it in Work asks for a project first, like a new chat, and keeps what it makes with that project.
- 5ead2cc: Import GitHub and Linear issues into Work and review exact GitHub PR revisions manually or through signed automatic intake. Retain captured Sources and review Outputs, isolate each workspace and credential owner, and approve publication separately.

  Apply migration `0061_project_task_integrations` before deployment. Configure the GitHub webhook secret and pull-request events for automatic intake, and pull-request write permission for publication.

- c126d04: Add model governance to Work. Workspaces can search Hugging Face, import models and datasets pinned to a commit, and review static inspection evidence that never loads the weights. Approvals follow versioned policies with dry runs, exceptions and expiry. Suites can be compared across serving routes with confidence intervals, and fine-tunes run on Hugging Face Jobs from governed conversation snapshots with lineage and a compute record. Approved versions can be served on dedicated Inference Endpoints, drift is caught by nightly replays, and any route or version exports as a CycloneDX ML-BOM. Workspaces can enforce approved routes in project chats, and generations carry route and version tags. Each workspace connects its own Hugging Face account or organisation under Govern, with the platform token as an optional default, and retiring a deployed route deletes its endpoint. Training moves from Profile to Models › Build, and Hub staging for Bedrock imports is keyed by commit.
- 90f7110: Turn Work › Models into a model platform on the workspace's own provider accounts. Connect Hugging Face, AWS, Together, Fireworks, Nebius, Google Vertex, Azure AI Foundry, RunPod, Cloudflare Workers AI or any OpenAI-compatible endpoint, then upload weights or register them from a bucket, build governed datasets from files, the Hub, buckets, rated conversations or a teacher model, and train with supervised, preference, reinforcement, distillation, embedding, merge or quantise runs after comparing trainers on fit and cost. Deployments are sized and priced per host, serve through aliases with eval gates, canaries and rollback, and appear in chat as models. Governance adds per-action permissions with separation of duties, budgets with spend approval, idle pause, revocation across lineage, erasure requests, an audit trail and CycloneDX, SPDX, model card and training content exports.

  The personal Training app, the training Worker and `component-experiences/training` are removed, and the API now mounts the platform under `/model-platform`.

- 169e2f5: Add the Polychat CLI, which pairs a terminal, server or gateway through a device code instead of a pasted API key, and show it on the downloads page. The device approval page now shows the code as cells, the requesting client, its expiry and what approval grants. Device sign-in clients no longer trip bot detection when they start and poll.
- 6966643: Grant selected actions from existing connectors directly to projects through Plugins, without creating a recipe. Reuse personal accounts, the connector catalogue, project capabilities and existing execution approvals. Preserve exclusions and narrower recipe permissions.
- d3f1df3: Automations leave the teammates library for their own Scheduled place. The Chat and Work sidebars link to it under Teammates, and the recipe cards, filters, schedule dialogs and deep links move with it.
- 57f8a16: Add Sites, a generative site builder that works from one brief. Jev classifies the brief into a plan (kind, scope, tone, palette, model tier), a tier-selected coding model streams the site as JSON Patch lines against a guardrailed component catalogue, and the shell renders every patch the moment it lands. `library-sites` holds the catalogue, patch stream compiler, validator and repair, prompt assembly, theme tokens and a deterministic Next.js and Tailwind code generator; `component-sites` holds the live React registry, themed preview and code view. Sites persist as revisioned outputs, refine in follow-ups, export as runnable project files, and hand off to a project's sandbox for a full build. The SSE buffer parser now lives once in `utility-core`. Sites are interactive (state, bindings, visibility, repeat, filters and actions in both the live renderer and the generated code), editable in place through an element inspector with zero-token edits and scoped refinement, exportable straight to a pull request with generated images, embeddable in chat through the `build_site` tool, revisioned with restore and public preview links, and judged by Jev at planning, refinement, quality-scoring and prompt-evaluation time.

### Patch Changes

- ac1b6d6: Replace browser pop-ups with in-app dialogs and toasts, and stop Attention showing Chat users a Work sales page.

  - Renaming a conversation in the Chat or Work sidebar opens a shared `RenameConversationDialog` instead of `window.prompt`, and rename, upload and history-export failures show a toast instead of `window.alert`.
  - Attention shows everyone signed in their background tasks. Workspace attention and the task inbox stay Pro-only, and non-Pro users see a short note pointing at Work instead of the full `WorkAccessEmptyState` panel.
  - The Workspaces page no longer repeats the notification inbox that Attention already shows; it shows an unread count linking to Attention.

- dd4389b: Let React artifacts show live data and charts. An artifact can declare read-only connector reads in a leading `<bindings>` block and read them with `usePolychatData` from `@polychat/data`. The host runs each read through the API, which takes the declaration from the stored message, refuses operations that change anything, only lets a refetch change declared arguments, caches results for a minute and rate-limits each artifact. React artifacts now compile with Sucrase instead of Babel standalone, can import `recharts`, and are assembled without string replacement, so `$` sequences and `</script>` in component source no longer corrupt the page.
- ee31a6d: Call the Poly by its name everywhere. The `meta` conversation type is now `poly`, the `meta_assistant` request field is now `poly`, and the meta assistant contracts, prompts, tools, hooks and overlay are renamed to match (`POLY_NAVIGATION_TOOL_NAMES`, `polyRequestSchema`, `buildPolyPrompt`, `PolyOverlay`, `usePolyNavigation`). A data migration moves stored `meta` conversations to `poly`. Behaviour is unchanged.
- 462cbe7: Keep long-lived tabs current. Builds now publish `version.json` with their build id, and an open tab checks it when it becomes visible and every half hour, offering a refresh when a newer build is live. A chunk that fails to load after a deploy reloads the page once, with a cooldown so a broken build cannot loop, and a waiting service worker now offers the same refresh instead of only logging.
- a8cf8a8: Give Work projects an overview page and consistent section navigation.

  - The project home shows open tasks, with anything blocked or waiting for review listed first, plus a preview of the project brief beside its conversations. `ProjectTasksSummary` was already built but not used anywhere, and the brief was only visible in Settings.
  - Project section tabs now read Overview · Tasks · Files · Activity, with a More menu for Teammates, Scheduled, Plugins and Settings, which were previously reachable only from the sidebar.
  - The Activity page uses the shared project header, so its tabs match the other project pages. `ProjectActivity` now takes `workspaceId`.
  - "Add a task" on the overview opens the task board with the create dialog already open (`?new=1`).
  - `component-workspaces` exports a new `ProjectBriefPreview`.
  - Teammates, Scheduled, Plugins and Settings now show the project tabs as well: `CapabilityLibrary`, `ScheduledLibrary` and `PluginsLibrary` accept an optional `navigation` slot. On Settings the tabs replace the "Back to project" link.

- Updated dependencies [6db7a00]
- Updated dependencies [ece96c4]
- Updated dependencies [33133cc]
- Updated dependencies [4968623]
- Updated dependencies [b4c0c65]
- Updated dependencies [dd4389b]
- Updated dependencies [d3f1df3]
- Updated dependencies [297b848]
- Updated dependencies [3c23660]
- Updated dependencies [b105d00]
- Updated dependencies [462cbe7]
- Updated dependencies [b105d00]
- Updated dependencies [f933fa8]
- Updated dependencies [d25fd94]
- Updated dependencies [5ead2cc]
- Updated dependencies [ac1b6d6]
- Updated dependencies [dd4389b]
- Updated dependencies [b105d00]
- Updated dependencies [462cbe7]
- Updated dependencies [b105d00]
- Updated dependencies [c126d04]
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
- Updated dependencies [5deae3a]
- Updated dependencies [6966643]
- Updated dependencies [1e5cafb]
- Updated dependencies [462cbe7]
- Updated dependencies [e4ba666]
- Updated dependencies [1df361b]
- Updated dependencies [6e76041]
- Updated dependencies [d3f1df3]
- Updated dependencies [de24f4b]
- Updated dependencies [77a5ee5]
- Updated dependencies [57f8a16]
- Updated dependencies [07290f2]
- Updated dependencies [cb9ddcc]
- Updated dependencies [a8cf8a8]
  - @ngriffin_uk/polychat-schemas@1.2.0
  - @ngriffin_uk/polychat-utility-core@0.3.0
  - @ngriffin_uk/polychat-component-conversation@2.0.0
  - @ngriffin_uk/polychat-library-client@0.3.0
  - @ngriffin_uk/polychat-library-chat@1.1.0
  - @ngriffin_uk/polychat-component-content@1.1.0
  - @ngriffin_uk/polychat-library-react@0.4.0
  - @ngriffin_uk/polychat-component-workspaces@0.3.0
  - @ngriffin_uk/polychat-component-shell@1.1.0
  - @ngriffin_uk/polychat-component-navigation@0.4.0
  - @ngriffin_uk/polychat-component-ui@0.4.0
  - @ngriffin_uk/polychat-utility-react@0.3.0
  - @ngriffin_uk/polychat-component-experiences@0.4.0
  - @ngriffin_uk/polychat-component-models@1.1.0
  - @ngriffin_uk/polychat-component-capabilities@0.3.0
  - @ngriffin_uk/polychat-component-account@0.2.2
  - @ngriffin_uk/polychat-library-realtime@0.1.2

## 0.2.0

### Minor Changes

- 4789c96: Give the desktop window the Apps place, and share one app runtime with the web application.

  Apps was the last Chat route the desktop answered with a 404. The runtimes behind it — Notes, Articles, Recordings, Strudel, the image studio, Replicate and fine-tuning — were already thin compositions over `component-experiences` and `library-react`, but the compositions themselves lived in `apps/app` where nothing else could reach them.

  `component-shell` now owns `AppRoute`, `AppRuntime` and every runtime it dispatches to, so both hosts open the same apps from the same code and `/chat/apps/:appId/*` works in the desktop window.

  `component-experiences` declares the `@strudel/*` packages its music surface imports at runtime. They previously resolved only because `apps/app` happened to declare them and pnpm hoisted them into reach; a second consumer would have bundled a broken dynamic import.

- 4789c96: Give the desktop window the Files place, and share one implementation with the web application.

  Files was one of three places the shared sidebar links to that the desktop answered with a 404. The libraries behind it — sources, outputs and memory documents — already lived in shared packages; only the pages composing them were stranded in `apps/app`.

  `component-shell` now owns `FilesPage` with its Made, Given and Memory libraries, the connected `SignInEmptyState`, the connected `ResponseRenderer`, and `ChatPlaceShell` — the sidebar-and-scroll frame the web chat layout used to spell out inline and the desktop needed to repeat. `SignInEmptyState` asks the shell host to open sign-in rather than reaching for the web login modal, so the desktop opens its own browser sign-in from the same empty state.

- 4789c96: Give the desktop window the Teammates place, the teammate editor and the tool runner.

  Teammates was the last of the three places the shared sidebar links to that the desktop answered with a 404, and it carried the largest tail: the capability library and its dialogs, the recipe workflow controller, the connector setup dialogs and the teammate editor all lived in `apps/app`.

  They move into `component-shell` unchanged, and both hosts render the same library, the same hire, share and skill dialogs, and the same connector setup. `library-react` publishes `NEW_TEAMMATE_ID` beside `getTeammateEditorPath`, so the constant belongs with the paths that use it rather than to whichever page happened to define it.

  The desktop still answers 404 for `/chat/apps/:appId`, which needs the application runtimes rather than the capability library.

- 4789c96: Let anyone sign out from the shell, and let the desktop window sign out at all.

  The desktop application had a `sign_out` command in Rust that nothing ever called. A signed-in window held its session in the operating system keychain with no way to give it back, so the only way off an account was to delete the credential by hand. On the web, signing out was buried in the profile page.

  The sidebar settings popover now carries a sign-out entry beside the account links, and `ShellHost` gains a required `signOut` so each host does what signing out means for it: the web ends the session through the API, and the desktop ends it through the API _and_ forgets the keychain entry, so a window that cannot reach the API still stops holding the credential.

### Patch Changes

- 505ce6a: Give the desktop window every page the web application serves.

  The desktop had the Chat places and nothing else. Work went nowhere, because its connected containers lived in `apps/app` where only the web could reach them, and the same was true of the conversation home, Profile, Models, Discover, Pets, Pricing and the legal pages. The mode toggle, the Discover section and the settings popover all linked to routes the window answered with a 404.

  - The connected Work containers, the conversation home, Profile, Models, Discover, Pets, Pricing and the legal pages moved into `component-shell` beside the Chat places they already shared. `WorkPlaceShell` is the Work frame, reading the workspace and project from the route the way `ChatPlaceShell` reads the Chat place.
  - The desktop registers a page directory for each of them, so every link either host renders now resolves in both.
  - Ask Poly and the project picker moved into a shared `ShellDialogs` the desktop mounts through `ShellHostProvider`, and the desktop drops the throwing placeholder it used for Ask Poly.
  - The desktop wraps its routes in the shared error page, so a render failure explains itself instead of leaving a blank window.
  - `polychat://` links reach Work, Profile and Discover as well as Chat, which is what the attention notifications the window already raises point at.
  - The window title names the open place rather than staying "Polychat".
  - House fonts and built-in pet sheets ship inside `component-ui` and resolve through each host's bundler, replacing the static `/fonts` and `/pets` directory the desktop reached by symlink.

- 505ce6a: Let the desktop window turn its own task notifications on.

  Task notification settings only knew how a browser delivers. The switch asked for browser permission, waited for a `platform: "web"` push registration against this installation, and disabled every category until one existed. The desktop window has no service worker and never registers, so the switch sat disabled, `preferences.enabled` could never become true, and the local notifications and icon badge the Rust core already knows how to raise stayed silent — even though the window polls Attention for exactly that purpose.

  How a device delivers is now a host concern. `ShellHost` carries a `useTaskNotificationChannel` hook: the web passes `useWebPushTaskNotificationChannel`, which keeps the permission, registration and retry behaviour it had, and the desktop passes `useDeviceTaskNotificationChannel`, which only flips the account preference because the running window is the delivery. The categories are shared either way and read the same server preferences through `useTaskNotificationPreferences`.

  The desktop icon badge follows the same switch, so turning task notifications off clears it rather than leaving a count behind.

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

- 4789c96: Give the desktop window the Attention place.

  Attention is the second of the three places the shared sidebar links to that the desktop answered with a 404. The page was already built entirely from shared packages, so it moves from `apps/app` into `component-shell` unchanged and both hosts render the same one.

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
- Updated dependencies [4789c96]
- Updated dependencies [4789c96]
  - @ngriffin_uk/polychat-library-react@0.3.0
  - @ngriffin_uk/polychat-schemas@1.1.0
  - @ngriffin_uk/polychat-component-shell@1.0.0
  - @ngriffin_uk/polychat-component-ui@0.3.0
  - @ngriffin_uk/polychat-component-experiences@0.3.0
  - @ngriffin_uk/polychat-component-navigation@0.3.0
  - @ngriffin_uk/polychat-component-account@0.2.1
  - @ngriffin_uk/polychat-component-conversation@1.0.1
  - @ngriffin_uk/polychat-component-capabilities@0.2.1
  - @ngriffin_uk/polychat-component-content@1.0.1
  - @ngriffin_uk/polychat-component-models@1.0.1
  - @ngriffin_uk/polychat-component-workspaces@0.2.1

## 0.1.0

### Minor Changes

- 42c36ea: Release the applications from changesets. Merging a changeset that names an application versions it, tags it and publishes a GitHub release with its changelog entry; the desktop release also carries macOS, Windows and Linux archives built on their own runners. The API serves those archives from `/desktop/downloads` and answers the desktop updater from `/desktop/releases`, so neither the website nor the application needs to know where the builds are hosted.
- f440eb7: Collapse the seven sandbox tools into one `run_sandbox_task` with a `taskType` argument, and add a `sandbox-tasks` skill covering how to pick the type and write a task an unattended run can complete. `run_feature_implementation`, `run_code_review`, `run_test_suite`, `run_bug_fix`, `run_refactoring`, `run_documentation` and `run_migration` are removed.
- 7d3c809: Share one connected navigation shell between the web and desktop applications.

  `component-shell` is a new package holding the wiring layer that previously lived only in `apps/app`: the chat sidebar with its conversation list and menus, the product and conversation headers, the page and product shells, global search, the settings popover and the not-found page. It is the single exception to the router-, store- and client-free rule for `component-*` packages, because connecting the controlled presentation in `component-navigation` and `component-ui` to the stores and router is its whole job.

  What differs between hosts arrives through `ShellHostProvider`: the origin public share links point at, the dialogs a host owns alone, and the actions that open them. A host that has not migrated an action supplies one that throws, so a gap stays visible instead of becoming a control that quietly does nothing.

  `library-react` publishes `DISCOVER_PATH` alongside the existing place paths, and `library-client` publishes `WEB_APP_BASE_URL` so a host without a web origin can still build share links.

  `component-conversation` drops `ConversationHeader`. It was the desktop's stand-in for a real header and is replaced by the shared `ConversationProductHeader`.

- f440eb7: Retrieval becomes a tool the model calls. `search_documents` searches the user's own material and returns passages; the `use_rag` request flag, the composer toggle and the RAG settings panel are removed, along with the prompt augmentation that fired on every message whether or not the turn needed it.

  Memory recall splits cleanly: the synthesis stays in the prompt because it is short and always relevant, and per-turn similarity search gives way to `search_memories`, which the model calls when it needs a specific memory.

  Conversation titles are generated as post-turn server work and arrive on the stream, so a first turn no longer costs an extra client round trip. The client still titles conversations the server does not store.

### Patch Changes

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
  - @ngriffin_uk/polychat-component-conversation@1.0.0
  - @ngriffin_uk/polychat-component-account@0.2.0
  - @ngriffin_uk/polychat-component-capabilities@0.2.0
  - @ngriffin_uk/polychat-component-content@1.0.0
  - @ngriffin_uk/polychat-component-experiences@0.2.0
  - @ngriffin_uk/polychat-component-workspaces@0.2.0
  - @ngriffin_uk/polychat-library-realtime@0.1.1
  - @ngriffin_uk/polychat-library-surface@0.2.0
  - @ngriffin_uk/polychat-utility-react@0.2.0
  - @ngriffin_uk/polychat-component-shell@0.2.0
