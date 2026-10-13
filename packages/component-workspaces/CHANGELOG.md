# @ngriffin_uk/polychat-component-workspaces

## 0.3.0

### Minor Changes

- d3f1df3: Canvas is a place, not a mode toggle. Chat and Work sidebars link to it above Files; opening it in Work asks for a project first, like a new chat, and keeps what it makes with that project.
- c126d04: Add model governance to Work. Workspaces can search Hugging Face, import models and datasets pinned to a commit, and review static inspection evidence that never loads the weights. Approvals follow versioned policies with dry runs, exceptions and expiry. Suites can be compared across serving routes with confidence intervals, and fine-tunes run on Hugging Face Jobs from governed conversation snapshots with lineage and a compute record. Approved versions can be served on dedicated Inference Endpoints, drift is caught by nightly replays, and any route or version exports as a CycloneDX ML-BOM. Workspaces can enforce approved routes in project chats, and generations carry route and version tags. Each workspace connects its own Hugging Face account or organisation under Govern, with the platform token as an optional default, and retiring a deployed route deletes its endpoint. Training moves from Profile to Models › Build, and Hub staging for Bedrock imports is keyed by commit.
- 1df361b: Remove unused public exports and dead helpers, consolidate duplicated duration, identifier, status, model-grouping, JSON, SMS and timing-safe comparison logic into shared modules, narrow the desktop backend option types to the interfaces each runner uses, and surface previously silent validation and rewrite failures in the UI.
- d3f1df3: Automations leave the teammates library for their own Scheduled place. The Chat and Work sidebars link to it under Teammates, and the recipe cards, filters, schedule dialogs and deep links move with it.
- de24f4b: Filter global search by kind, and show unread Attention counts in both sidebars.

  - The search dialog shows filter chips (All, Chats, Projects, Workspaces, Capabilities), each with a count. Only kinds present in the results are offered, and arrow keys and Enter work on the filtered list.
  - `SidebarNavLink` accepts `count` and `countLabel`, and `component-navigation` exports `SidebarCountBadge`. The badge caps at 99+ and gives screen readers a text label (an `aria-label` on a plain `<span>` isn't reliably announced).
  - The Chat sidebar's Attention link and the Work sidebar's Attention link (`WorkSidebarNav` `attentionCount`) show the unread notification count. The per-project Tasks badge uses the same component.

- 57f8a16: Add Sites, a generative site builder that works from one brief. Jev classifies the brief into a plan (kind, scope, tone, palette, model tier), a tier-selected coding model streams the site as JSON Patch lines against a guardrailed component catalogue, and the shell renders every patch the moment it lands. `library-sites` holds the catalogue, patch stream compiler, validator and repair, prompt assembly, theme tokens and a deterministic Next.js and Tailwind code generator; `component-sites` holds the live React registry, themed preview and code view. Sites persist as revisioned outputs, refine in follow-ups, export as runnable project files, and hand off to a project's sandbox for a full build. The SSE buffer parser now lives once in `utility-core`. Sites are interactive (state, bindings, visibility, repeat, filters and actions in both the live renderer and the generated code), editable in place through an element inspector with zero-token edits and scoped refinement, exportable straight to a pull request with generated images, embeddable in chat through the `build_site` tool, revisioned with restore and public preview links, and judged by Jev at planning, refinement, quality-scoring and prompt-evaluation time.
- a8cf8a8: Give Work projects an overview page and consistent section navigation.

  - The project home shows open tasks, with anything blocked or waiting for review listed first, plus a preview of the project brief beside its conversations. `ProjectTasksSummary` was already built but not used anywhere, and the brief was only visible in Settings.
  - Project section tabs now read Overview · Tasks · Files · Activity, with a More menu for Teammates, Scheduled, Plugins and Settings, which were previously reachable only from the sidebar.
  - The Activity page uses the shared project header, so its tabs match the other project pages. `ProjectActivity` now takes `workspaceId`.
  - "Add a task" on the overview opens the task board with the create dialog already open (`?new=1`).
  - `component-workspaces` exports a new `ProjectBriefPreview`.
  - Teammates, Scheduled, Plugins and Settings now show the project tabs as well: `CapabilityLibrary`, `ScheduledLibrary` and `PluginsLibrary` accept an optional `navigation` slot. On Settings the tabs replace the "Back to project" link.

### Patch Changes

- b105d00: Keep search filters usable when results change and preserve keyboard activation of dialog controls. Prioritise blocked and review tasks consistently across project overviews and boards.

  Preserve task drafts after failed saves, prevent duplicate submissions, and distinguish saved tasks from failed starts. Follow task creation links on an open board and show Attention loading and notification errors accurately.

- Updated dependencies [6db7a00]
- Updated dependencies [ece96c4]
- Updated dependencies [33133cc]
- Updated dependencies [4968623]
- Updated dependencies [b4c0c65]
- Updated dependencies [d3f1df3]
- Updated dependencies [297b848]
- Updated dependencies [3c23660]
- Updated dependencies [b105d00]
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
- Updated dependencies [de24f4b]
- Updated dependencies [57f8a16]
- Updated dependencies [07290f2]
- Updated dependencies [cb9ddcc]
  - @ngriffin_uk/polychat-schemas@1.2.0
  - @ngriffin_uk/polychat-utility-core@0.3.0
  - @ngriffin_uk/polychat-component-navigation@0.4.0
  - @ngriffin_uk/polychat-component-ui@0.4.0
  - @ngriffin_uk/polychat-utility-react@0.3.0

## 0.2.1

### Patch Changes

- Updated dependencies [4789c96]
- Updated dependencies [505ce6a]
- Updated dependencies [4789c96]
- Updated dependencies [34380a3]
- Updated dependencies [4789c96]
  - @ngriffin_uk/polychat-schemas@1.1.0
  - @ngriffin_uk/polychat-component-ui@0.3.0
  - @ngriffin_uk/polychat-component-navigation@0.3.0

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
- 1836aad: Give a project task the fields a work item needs: acceptance criteria as separate checkable items, an expected deliverable, context, constraints including tools withheld from the run, dependencies that gate a start, a per-task approval policy, priority and a due date. Enforced fields and descriptive ones are stated separately so neither is mistaken for the other.

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
  - @ngriffin_uk/polychat-component-navigation@0.2.0
  - @ngriffin_uk/polychat-component-ui@0.2.0
  - @ngriffin_uk/polychat-utility-core@0.2.0
  - @ngriffin_uk/polychat-utility-react@0.2.0
