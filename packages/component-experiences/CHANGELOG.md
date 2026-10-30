# @ngriffin_uk/polychat-component-experiences

## 0.7.1

### Patch Changes

- Updated dependencies [2a427dd]
- Updated dependencies [54bf2d3]
- Updated dependencies [8642a45]
  - @ngriffin_uk/polychat-component-ui@0.7.0
  - @ngriffin_uk/polychat-schemas@1.12.0
  - @ngriffin_uk/polychat-component-content@1.3.5

## 0.7.0

### Minor Changes

- afe0236: Notes, Article Processor and Paperwork now live in Files instead of in their own apps.

  - **Notes write where they live.** The Note tile in Files opens a blank note straight in the editor that the Note Taker app used to have: sepia or plain, your font and size, dictation, tab audio, notes from a recording link and AI assist. Every note opens ready to edit, including notes Poly saves for you and notes in notebooks. A blank note you close without writing is thrown away.
  - **Note details are still there.** Metadata on a note shows its summary, topics, tags, type, sentiment and where it was captured from, plus word count and reading time. You can edit the details, or regenerate the summary. Details from your old notes come across with them.
  - **Reading settings in one place.** The Aa button sets the typeface, sepia or app-matching paper and a text size from 12 to 40px. It applies to every note you open.
  - **Quicker panels.** File info, Knowledge, and Reading or Framing (where they apply) have their own buttons beside Ask in the file viewer.
  - **Version history and comments on notes.** Each editing session keeps a version you can read and bring back from Version history. Notes take comments and threads like documents do, and in a project you can mention a teammate to pick one up.
  - **Safe across tabs.** If a note changes somewhere else while you are typing, Files tells you and lets you keep your edits or use the saved version.
  - **How it's framed, for anything you file.** Links and pasted text in Files can be checked for slant, tone, sourcing, loaded wording and what they leave out. This is the same check Discover uses. Ask Poly to analyse an article and it files the piece and reads its framing in one go.
  - **Make a report from a folder.** A folder's menu has Make a report, which writes a briefing, study guide, FAQ or post from the folder's files. The report lands in the folder as a document you can edit.
  - **Read as receipt, invoice or damage claim.** Any photo, PDF or text in Files can be read as a receipt, invoice or damage claim. Doubtful figures are flagged and the source text is highlighted where each value came from.
  - **Folders that read their own paperwork.** Set a folder's Read files as option and every file already in it, and every file added later, is read automatically, including files from connected syncs. The folder then shows a ledger with a running total, an Export CSV button and Save as sheet.
  - Your existing notes and article reports have moved into Files. Each article session becomes a folder holding its articles and its report. The Note Taker, Article Processor and Paperwork apps are gone from Apps.

### Patch Changes

- Updated dependencies [0af6a2b]
- Updated dependencies [afe0236]
- Updated dependencies [c79e769]
- Updated dependencies [810eff4]
- Updated dependencies [00f22ad]
  - @ngriffin_uk/polychat-schemas@1.10.0
  - @ngriffin_uk/polychat-utility-core@0.9.0
  - @ngriffin_uk/polychat-component-ui@0.6.2
  - @ngriffin_uk/polychat-component-content@1.3.4

## 0.6.3

### Patch Changes

- Updated dependencies [5d70d5d]
- Updated dependencies [8f480ac]
  - @ngriffin_uk/polychat-schemas@1.9.0
  - @ngriffin_uk/polychat-utility-core@0.8.0
  - @ngriffin_uk/polychat-component-ui@0.6.1
  - @ngriffin_uk/polychat-component-content@1.3.3

## 0.6.2

### Patch Changes

- Updated dependencies [ce66ee9]
- Updated dependencies [11dabe3]
- Updated dependencies [ed38a63]
- Updated dependencies [48eb3dc]
- Updated dependencies [ed38a63]
  - @ngriffin_uk/polychat-schemas@1.8.0
  - @ngriffin_uk/polychat-utility-core@0.7.0
  - @ngriffin_uk/polychat-component-ui@0.6.0
  - @ngriffin_uk/polychat-component-content@1.3.2

## 0.6.1

### Patch Changes

- Updated dependencies [187afde]
- Updated dependencies [d2905a6]
- Updated dependencies [0fe409a]
- Updated dependencies [0fe409a]
- Updated dependencies [e0ca7c6]
- Updated dependencies [e0ca7c6]
  - @ngriffin_uk/polychat-schemas@1.6.0
  - @ngriffin_uk/polychat-utility-core@0.6.0
  - @ngriffin_uk/polychat-component-content@1.3.1
  - @ngriffin_uk/polychat-component-ui@0.5.1

## 0.6.0

### Minor Changes

- 06c02dd: Discover is your morning edition from Poly. Open Discover in the Chat sidebar, turn it on, and each morning Poly leaves a brief, painted topic tiles, reading, automations worth setting up and the odd check-in, built from what you've been talking about.

  - Pick any card to open it beside the feed with its own conversation, then tell Discover more, less or never. Follow a topic and it gets a notebook that collects each day's best links.
  - The Perch is a short two-host round-up of each edition, in your podcast show and its private feed.
  - Today's episode is a narrated, illustrated part of a five-day season on your top topic, with chapters, camera moves and a listen-only mode. Save a season as one long listen for your podcast app.
  - Wind down makes a five, ten or twenty minute breathing, body-scan or unwind session for the evening. It starts speaking within seconds, over quiet music made for the session that you can turn off.
  - Today's episode, The Perch and Wind down share one player beside the feed, and keep playing while you read other cards.
  - Connect Readwise, Last.fm, Trakt, Hardcover or Podcast Index, and Discover reads what you're reading, listening to and watching. Notebooks can now keep connected sources up to date.
  - From before cards bring back flashcards you missed, links you saved a while ago and what you were doing a year ago.
  - On Sundays, Your week is a short private recap of what you made, learned and finished.
  - Turn on Tell me when it's ready and Poly lets you know on your phone and connected channels when the edition lands.
  - Settings lists your connected services, each with its own switch for Discover. Oura and Audiobookshelf can now be connected too, and on iPhone Discover can use yesterday's Apple Health summary for the brief.
  - Health, sexuality, religion, politics and money only appear when you follow them or ask. Episodes and their quizzes and flashcards land in a followed topic's notebook, and episodes open in Files with the same player.
  - Audio and video across chat, Files and notebooks now use one player.
  - The product tour now lives at /tour. On iOS, Discover is in the menu and there is a Today widget.
  - Long structured generations no longer give up after 100 seconds, so episodes and other background work finish instead of failing part way.
  - Podcasts and episodes now show their real length and jump to the right place when you scrub or resume.
  - Background work interrupted part way, by a deploy or a crash, now picks up again instead of sitting unfinished.

- 7b36da1: Sources is now where your media lives. Files' Given tab is renamed Sources and gains Podcasts, Image Studio and Replicate alongside the library.

  - Upload images, audio and video straight into Sources. Open any audio or video source to play it, transcribe it, write notes with decisions and action items, and make cover art. The transcript becomes searchable, so recordings work as grounding like any other source. This replaces the Recording Processor app.
  - Image Studio, sketch-to-painting and Replicate runs now save what they make into Sources, where it can be reused as material. They have moved out of Apps and the Canvas sidebar item into Files › Sources.
  - Make podcasts from your sources: pick sources, a format (deep dive, brief, debate or critique) and a length, and two hosts talk it through. Each episode lands in Sources with its audio, transcript, show notes and cover.
  - Group episodes into shows and create a private RSS feed link to subscribe in any podcast app. Making a new link turns off the old one.
  - Ask Poly or a teammate to make an episode with the new podcast tool, or install the Podcast Briefing recipe to get a fresh episode on your topics or Sources on a schedule.

### Patch Changes

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
  - @ngriffin_uk/polychat-component-content@1.3.0

## 0.5.0

### Minor Changes

- 65fbf81: Refresh the realtime providers and Note Taker. Notes dictation now runs on the shared live session with any ready transcription provider and commits OpenAI turns on silence. Gemini Live defaults to Gemini 3.8 Live, OpenAI transcription sends the `languages` field and drops the retired Whisper and GPT-4o models, translation sessions use the dedicated translations endpoints, and proxied transcription sessions settle billing on their measured audio instead of a flat reservation. The proxy audio cap now covers the full session length, Notes lists return excerpts with server-side search, metadata is only described once a note has enough text, and the unused video analysis options are gone.
- b97c227: Recording summaries now come from the auxiliary model as structured notes: a summary, the decisions and the action items with owner and due date when the recording states them. In a project, each action item can be added to the task board.
- e41549c: Keep transcription timings. Providers return segments and words, `/audio/transcribe?timestamps=true` includes them, notes from media quote real `[m:ss]` markers instead of guessing, and recordings play captions and download them as SRT or VTT.

### Patch Changes

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
  - @ngriffin_uk/polychat-component-content@1.2.0
  - @ngriffin_uk/polychat-component-ui@0.4.1

## 0.4.0

### Minor Changes

- 90f7110: Turn Work › Models into a model platform on the workspace's own provider accounts. Connect Hugging Face, AWS, Together, Fireworks, Nebius, Google Vertex, Azure AI Foundry, RunPod, Cloudflare Workers AI or any OpenAI-compatible endpoint, then upload weights or register them from a bucket, build governed datasets from files, the Hub, buckets, rated conversations or a teacher model, and train with supervised, preference, reinforcement, distillation, embedding, merge or quantise runs after comparing trainers on fit and cost. Deployments are sized and priced per host, serve through aliases with eval gates, canaries and rollback, and appear in chat as models. Governance adds per-action permissions with separation of duties, budgets with spend approval, idle pause, revocation across lineage, erasure requests, an audit trail and CycloneDX, SPDX, model card and training content exports.

  The personal Training app, the training Worker and `component-experiences/training` are removed, and the API now mounts the platform under `/model-platform`.

### Patch Changes

- b105d00: Preserve line breaks while entering media URL lists and remove blank entries at submission. Accept required boolean values set to false, retain enum value types and prevent submissions while generation is pending.
- 1df361b: Remove unused public exports and dead helpers, consolidate duplicated duration, identifier, status, model-grouping, JSON, SMS and timing-safe comparison logic into shared modules, narrow the desktop backend option types to the interfaces each runner uses, and surface previously silent validation and rewrite failures in the UI.
- Updated dependencies [6db7a00]
- Updated dependencies [ece96c4]
- Updated dependencies [33133cc]
- Updated dependencies [4968623]
- Updated dependencies [b4c0c65]
- Updated dependencies [dd4389b]
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
- Updated dependencies [77a5ee5]
- Updated dependencies [57f8a16]
- Updated dependencies [07290f2]
- Updated dependencies [cb9ddcc]
  - @ngriffin_uk/polychat-schemas@1.2.0
  - @ngriffin_uk/polychat-utility-core@0.3.0
  - @ngriffin_uk/polychat-component-content@1.1.0
  - @ngriffin_uk/polychat-component-ui@0.4.0

## 0.3.0

### Minor Changes

- 4789c96: Give the desktop window the Apps place, and share one app runtime with the web application.

  Apps was the last Chat route the desktop answered with a 404. The runtimes behind it — Notes, Articles, Recordings, Strudel, the image studio, Replicate and fine-tuning — were already thin compositions over `component-experiences` and `library-react`, but the compositions themselves lived in `apps/app` where nothing else could reach them.

  `component-shell` now owns `AppRoute`, `AppRuntime` and every runtime it dispatches to, so both hosts open the same apps from the same code and `/chat/apps/:appId/*` works in the desktop window.

  `component-experiences` declares the `@strudel/*` packages its music surface imports at runtime. They previously resolved only because `apps/app` happened to declare them and pnpm hoisted them into reach; a second consumer would have bundled a broken dynamic import.

### Patch Changes

- Updated dependencies [4789c96]
- Updated dependencies [505ce6a]
- Updated dependencies [4789c96]
- Updated dependencies [34380a3]
  - @ngriffin_uk/polychat-schemas@1.1.0
  - @ngriffin_uk/polychat-component-ui@0.3.0
  - @ngriffin_uk/polychat-component-content@1.0.1

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
- Updated dependencies [f440eb7]
- Updated dependencies [0a2d695]
- Updated dependencies [1836aad]
- Updated dependencies [19573b8]
  - @ngriffin_uk/polychat-schemas@1.0.0
  - @ngriffin_uk/polychat-component-ui@0.2.0
  - @ngriffin_uk/polychat-utility-core@0.2.0
  - @ngriffin_uk/polychat-component-content@1.0.0
