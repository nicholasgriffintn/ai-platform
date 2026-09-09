# @assistant/app

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
