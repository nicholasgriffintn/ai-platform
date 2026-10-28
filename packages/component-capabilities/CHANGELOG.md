# @ngriffin_uk/polychat-component-capabilities

## 1.0.4

### Patch Changes

- Updated dependencies [0af6a2b]
- Updated dependencies [afe0236]
- Updated dependencies [c79e769]
- Updated dependencies [810eff4]
- Updated dependencies [00f22ad]
  - @ngriffin_uk/polychat-schemas@1.10.0
  - @ngriffin_uk/polychat-utility-core@0.9.0
  - @ngriffin_uk/polychat-component-ui@0.6.2

## 1.0.3

### Patch Changes

- Updated dependencies [5d70d5d]
- Updated dependencies [8f480ac]
  - @ngriffin_uk/polychat-schemas@1.9.0
  - @ngriffin_uk/polychat-utility-core@0.8.0
  - @ngriffin_uk/polychat-component-ui@0.6.1

## 1.0.2

### Patch Changes

- Updated dependencies [ce66ee9]
- Updated dependencies [11dabe3]
- Updated dependencies [ed38a63]
- Updated dependencies [48eb3dc]
- Updated dependencies [ed38a63]
  - @ngriffin_uk/polychat-schemas@1.8.0
  - @ngriffin_uk/polychat-utility-core@0.7.0
  - @ngriffin_uk/polychat-component-ui@0.6.0

## 1.0.1

### Patch Changes

- Updated dependencies [187afde]
- Updated dependencies [d2905a6]
- Updated dependencies [0fe409a]
- Updated dependencies [0fe409a]
- Updated dependencies [e0ca7c6]
- Updated dependencies [e0ca7c6]
  - @ngriffin_uk/polychat-schemas@1.6.0
  - @ngriffin_uk/polychat-utility-core@0.6.0
  - @ngriffin_uk/polychat-component-ui@0.5.1

## 1.0.0

### Major Changes

- 6efa93c: Plugins, Teammates and Scheduled now share the Files toolbar: type filters on the left, search beside them, and one filter menu in place of the wall of category chips.

  - Each page opens on its first type, Integrations on Plugins, instead of a mixed All view.
  - Your filters live in the address bar, so a refresh, a shared link or the back button keeps you where you were.
  - Plugins opens with an Installed row of the integrations and tools you have set up. Select one to open it, or select Installed to see only those.
  - Category and "installed only" sit in the filter menu, which lights up while either is applied.

### Minor Changes

- 11381a9: Teammates are now people you message, not settings you edit.

  - **Teammate threads.** Opening a teammate opens its own conversation, which carries on between visits. The sidebar lists the teammates you are talking to and your groups, newest activity first, with anyone who needs you at the top. Those conversations no longer also appear in the chat list. The conversation uses the same workspace as any other chat, and its side panel sums up the teammate: what it is doing, its autonomy, and how many routines and connections it has, each a click from Working context.
  - **Groups.** Use "Add a teammate" on a teammate's page to put two to six teammates in one conversation. Use @name, or tap a name in the header, to choose who answers. Every reply shows which teammate wrote it, and messages teammates send back while they work collapse into one "Messages from…" line you can open.
  - **Reactions.** React to a reply from the smiley button, or long-press on iOS. 👍 and 👎 also tell the teammate how it did, and teammates react 👀 to your message when they pick it up instead of replying "On it". A reaction never approves anything.
  - **Receipts.** When a tool sends, books, pays, deletes or changes something, the conversation shows a short receipt such as "Created routine · Friday inbox tidy · every Friday at 09:00", with the full output one click away.
  - **Live with teammates.** Live now works in teammate and group conversations. Start it from the Live button and stop it from the same place; each spoken turn goes to the teammate with its tools, and anything it wants to do still waits for your approval.
  - **Slack and Telegram signals.** Connected channels react 👀 when a message is picked up, show a working status in Slack threads and swap to ⚠️ if the run fails. Choose "Also ✅ when it is done" or "No reactions" when you connect a channel.
  - **More teammates to hire.** New jobs for personal admin, productivity, sales and marketing, operations and engineering, including Inbox tidy, Trip watcher, Morning brief, Meeting prep, Bug reproduction and Expense manager. Each arrives with its own character and offers to set up its routine.
  - **Dry runs.** Run any set-up routine as a dry run. Anything that would send, write, spend or delete returns a draft instead, so you can check a routine before it goes live.
  - **Batch review.** When three or more approvals are waiting, tick the ones you want and approve them together. Each is still approved on its own, exactly as listed.

### Patch Changes

- a9f7c20: Every page now sits in the same frame.

  - **Titles in the header.** Tool, skill, invitation and app pages show their name in the top bar instead of "Chat" or "Work", with the same spacing as the rest of the app.
  - **One header for project teammates.** Opening a teammate inside a project no longer stacks a "Work" bar above the teammate's own header.
  - **Tidier errors.** When a workspace, project or task list fails to load, or needs you to sign in, the message appears inside the page with its title rather than floating on its own.
  - **Shared links.** Shared conversations and outputs show their title while loading.

- Updated dependencies [8b2929f]
- Updated dependencies [8b965f6]
- Updated dependencies [91c7d3d]
- Updated dependencies [7accf45]
- Updated dependencies [911642e]
- Updated dependencies [a9f7c20]
- Updated dependencies [bf39c94]
- Updated dependencies [b3e3ea2]
- Updated dependencies [1fe4222]
- Updated dependencies [06c02dd]
- Updated dependencies [f4841cd]
- Updated dependencies [abf8eb7]
- Updated dependencies [7b5038c]
- Updated dependencies [80fee8e]
- Updated dependencies [8b965f6]
- Updated dependencies [0a57f73]
- Updated dependencies [6efa93c]
- Updated dependencies [11381a9]
- Updated dependencies [91c7d3d]
- Updated dependencies [7b36da1]
- Updated dependencies [80fee8e]
- Updated dependencies [7a9f872]
- Updated dependencies [7accf45]
- Updated dependencies [d7716ff]
  - @ngriffin_uk/polychat-schemas@1.5.0
  - @ngriffin_uk/polychat-utility-core@0.5.0
  - @ngriffin_uk/polychat-component-ui@0.5.0

## 0.4.0

### Minor Changes

- e820856: MCP tool results keep their PNG, JPEG and WebP images for models that read images, and tool-result images reach every provider as real image input instead of serialised base64 text. MCP server settings offer Inspo as a one-click server for design references.

### Patch Changes

- 7bec25b: Add Polychat Benchmarks: GeoGuess, Countdown, Fermi Bets, Long Odds, Hamster Wheel and Strudel Groove, run on one engine for official, personal and workspace scopes. Results at `/benchmarks` show intervals, Artificial Analysis indexes with attribution, measured cost and a medal table, people can play the auto-scored benchmarks and vote on blind pairs, the Benchmarks app runs them against your own models and keys, and the model selector previews each model's standings.
- Updated dependencies [82c133e]
- Updated dependencies [005b9f3]
- Updated dependencies [393652d]
- Updated dependencies [e820856]
- Updated dependencies [7bec25b]
- Updated dependencies [65fbf81]
- Updated dependencies [65fbf81]
- Updated dependencies [b97c227]
- Updated dependencies [c965c69]
- Updated dependencies [06e4619]
- Updated dependencies [e41549c]
  - @ngriffin_uk/polychat-utility-core@0.4.0
  - @ngriffin_uk/polychat-schemas@1.4.0
  - @ngriffin_uk/polychat-component-ui@0.4.1

## 0.3.0

### Minor Changes

- 6966643: Grant selected actions from existing connectors directly to projects through Plugins, without creating a recipe. Reuse personal accounts, the connector catalogue, project capabilities and existing execution approvals. Preserve exclusions and narrower recipe permissions.

### Patch Changes

- 57f8a16: Add Sites, a generative site builder that works from one brief. Jev classifies the brief into a plan (kind, scope, tone, palette, model tier), a tier-selected coding model streams the site as JSON Patch lines against a guardrailed component catalogue, and the shell renders every patch the moment it lands. `library-sites` holds the catalogue, patch stream compiler, validator and repair, prompt assembly, theme tokens and a deterministic Next.js and Tailwind code generator; `component-sites` holds the live React registry, themed preview and code view. Sites persist as revisioned outputs, refine in follow-ups, export as runnable project files, and hand off to a project's sandbox for a full build. The SSE buffer parser now lives once in `utility-core`. Sites are interactive (state, bindings, visibility, repeat, filters and actions in both the live renderer and the generated code), editable in place through an element inspector with zero-token edits and scoped refinement, exportable straight to a pull request with generated images, embeddable in chat through the `build_site` tool, revisioned with restore and public preview links, and judged by Jev at planning, refinement, quality-scoring and prompt-evaluation time.
- Updated dependencies [6db7a00]
- Updated dependencies [ece96c4]
- Updated dependencies [33133cc]
- Updated dependencies [4968623]
- Updated dependencies [b4c0c65]
- Updated dependencies [d3f1df3]
- Updated dependencies [297b848]
- Updated dependencies [3c23660]
- Updated dependencies [462cbe7]
- Updated dependencies [b105d00]
- Updated dependencies [d25fd94]
- Updated dependencies [5ead2cc]
- Updated dependencies [dd4389b]
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
- Updated dependencies [57f8a16]
- Updated dependencies [07290f2]
- Updated dependencies [cb9ddcc]
  - @ngriffin_uk/polychat-schemas@1.2.0
  - @ngriffin_uk/polychat-utility-core@0.3.0
  - @ngriffin_uk/polychat-component-ui@0.4.0

## 0.2.1

### Patch Changes

- Updated dependencies [4789c96]
- Updated dependencies [505ce6a]
- Updated dependencies [4789c96]
- Updated dependencies [34380a3]
  - @ngriffin_uk/polychat-schemas@1.1.0
  - @ngriffin_uk/polychat-component-ui@0.3.0

## 0.2.0

### Minor Changes

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
- Updated dependencies [6334297]
- Updated dependencies [fc4ed91]
- Updated dependencies [0a2d695]
- Updated dependencies [1836aad]
- Updated dependencies [19573b8]
  - @ngriffin_uk/polychat-schemas@1.0.0
  - @ngriffin_uk/polychat-component-ui@0.2.0
  - @ngriffin_uk/polychat-utility-core@0.2.0
