# @ngriffin_uk/polychat-component-conversation

## 2.1.2

### Patch Changes

- Updated dependencies [ce66ee9]
- Updated dependencies [11dabe3]
- Updated dependencies [ed38a63]
- Updated dependencies [48eb3dc]
- Updated dependencies [ed38a63]
  - @ngriffin_uk/polychat-schemas@1.8.0
  - @ngriffin_uk/polychat-library-client@0.7.0
  - @ngriffin_uk/polychat-library-react@0.8.0
  - @ngriffin_uk/polychat-utility-react@0.5.0
  - @ngriffin_uk/polychat-utility-core@0.7.0
  - @ngriffin_uk/polychat-component-ui@0.6.0
  - @ngriffin_uk/polychat-component-content@1.3.2
  - @ngriffin_uk/polychat-component-models@1.2.3
  - @ngriffin_uk/polychat-component-navigation@0.5.2
  - @ngriffin_uk/polychat-component-experiences@0.6.2
  - @ngriffin_uk/polychat-library-chat@1.3.1
  - @ngriffin_uk/polychat-library-realtime@0.3.2

## 2.1.1

### Patch Changes

- Updated dependencies [187afde]
- Updated dependencies [d2905a6]
- Updated dependencies [0fe409a]
- Updated dependencies [0fe409a]
- Updated dependencies [e0ca7c6]
- Updated dependencies [e0ca7c6]
  - @ngriffin_uk/polychat-schemas@1.6.0
  - @ngriffin_uk/polychat-utility-core@0.6.0
  - @ngriffin_uk/polychat-library-client@0.6.0
  - @ngriffin_uk/polychat-library-react@0.7.0
  - @ngriffin_uk/polychat-component-content@1.3.1
  - @ngriffin_uk/polychat-component-experiences@0.6.1
  - @ngriffin_uk/polychat-component-models@1.2.2
  - @ngriffin_uk/polychat-component-navigation@0.5.1
  - @ngriffin_uk/polychat-component-ui@0.5.1
  - @ngriffin_uk/polychat-library-chat@1.2.1
  - @ngriffin_uk/polychat-library-realtime@0.3.1
  - @ngriffin_uk/polychat-utility-react@0.4.1

## 2.1.0

### Minor Changes

- bf39c94: Poly can now make slide decks and spreadsheets, not just documents. Ask for a deck or a sheet and it lands in Files, where you can flip through the slides, switch between tables, revise it in conversation and download it as Markdown or CSV. Spreadsheet downloads are safe to open, since text that looks like a formula is kept as text.

  Research now checks your own Sources and synced accounts alongside the web, and shows what it found from them beside the report. Your passages stay with Polychat and are never sent to the research provider.

- abf8eb7: A rebuilt iPhone app, and approvals that go back together.

  - **Four tabs on iPhone.** Home shows your Discover edition, morning or evening, with the brief, topics, links and the episode, The Perch, your week and wind down, each with its real status and artwork. Chats has a Chat and Work toggle for your own conversations and your projects. Attention gathers approvals, questions, reviews, your inbox and background tasks, with a badge on the app icon. Settings covers your account, default model, Discover, Apple Health and notifications.
  - **Replies stream properly on iPhone.** Text arrives as it is written, each step of a reply that uses tools shows in order, chats open at the latest message, and headings, lists, quotes, code and tables render the way they do on the web.
  - **iPhone keeps up with your other devices.** Conversations, running work and Attention update live when something changes on the web or desktop.
  - **Widgets show what's happening.** The Today, Attention and Poly widgets come in small, medium and large sizes and on the Lock Screen, with the latest edition, what's waiting on you and what Poly is working on.
  - **Approvals arrive as one set.** When Poly asks for several approvals at once, decide each one (or approve or reject the rest in one go) and Polychat sends every decision together once the set is complete, so Poly carries on with all of them rather than one at a time. This works on the web, desktop and iPhone.
  - **Voice and Apple Health from iPhone.** Dictation and the Apple Health switch work again from the app.

- 8b965f6: Conversation groups are now notebooks. Click a notebook's name in the sidebar to open it: your sources on the left, the chat in the middle and Studio on the right. Every chat in a notebook answers from the sources you tick, names the source behind each claim, and can search the notebook's earlier chats too.

  - Add sources from Files, uploads, web pages or pasted text, or search the web from the notebook. Fast research finds pages to pick from; deep research writes a report in the background and brings back the pages it cites.
  - Studio makes audio overviews, slide decks, video overviews, mind maps, reports, flashcards, quizzes, infographics and data tables from the ticked sources. The pencil on each tile lets you choose the format, length, style, language and focus.
  - Flashcards and quizzes remember how you got on. Click any topic in a mind map to ask about it.
  - Save any reply as a note, and turn a note into a source when you want chats to read it.
  - Configure a notebook to answer as a learning guide or a persona of your own, at the length you like, from its sources only or with the web as well.

- 0a57f73: Open any file and ask about it.

  - **One viewer for every file.** Documents, sources, recordings, images and memories all open in the same viewer. The title menu holds file info, version history, share links and every conversation about the file. Files opened from a chat, a run or a task open on top of where you were.
  - **Ask about this file.** The viewer has its own conversation. Polychat reads the file fresh on every turn, can revise a document as a new revision you can restore, and keeps the conversation with the file so you can pick it up later.
  - **Poly knows the page you are on.** Each place has a guide Poly reads whenever you ask it something there, and a fresh Poly conversation opens with that guide and a few starters. Your first chat opens with the guide to conversations.
  - **API.** Pass `conversation.subject` with `{ type, id }` when creating a response to start a conversation about a source, output or memory, and list them with `GET /conversations?subject_type=&subject_id=`. `GET /skills/guides` returns each place's guide.

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
- Updated dependencies [abf8eb7]
- Updated dependencies [80fee8e]
- Updated dependencies [7a9f872]
- Updated dependencies [7accf45]
- Updated dependencies [d7716ff]
  - @ngriffin_uk/polychat-schemas@1.5.0
  - @ngriffin_uk/polychat-utility-core@0.5.0
  - @ngriffin_uk/polychat-library-client@0.5.0
  - @ngriffin_uk/polychat-library-react@0.6.0
  - @ngriffin_uk/polychat-component-models@1.2.1
  - @ngriffin_uk/polychat-component-ui@0.5.0
  - @ngriffin_uk/polychat-component-content@1.3.0
  - @ngriffin_uk/polychat-library-chat@1.2.0
  - @ngriffin_uk/polychat-utility-react@0.4.0
  - @ngriffin_uk/polychat-component-experiences@0.6.0
  - @ngriffin_uk/polychat-component-navigation@0.5.0
  - @ngriffin_uk/polychat-library-realtime@0.3.0

## 2.0.1

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
  - @ngriffin_uk/polychat-library-client@0.4.0
  - @ngriffin_uk/polychat-library-react@0.5.0
  - @ngriffin_uk/polychat-component-models@1.2.0
  - @ngriffin_uk/polychat-component-content@1.2.0
  - @ngriffin_uk/polychat-library-realtime@0.2.0
  - @ngriffin_uk/polychat-component-experiences@0.5.0
  - @ngriffin_uk/polychat-component-navigation@0.4.1
  - @ngriffin_uk/polychat-component-ui@0.4.1
  - @ngriffin_uk/polychat-library-chat@1.1.1
  - @ngriffin_uk/polychat-utility-react@0.3.1

## 2.0.0

### Major Changes

- 1df361b: Remove unused public exports and dead helpers, consolidate duplicated duration, identifier, status, model-grouping, JSON, SMS and timing-safe comparison logic into shared modules, narrow the desktop backend option types to the interfaces each runner uses, and surface previously silent validation and rewrite failures in the UI.

### Minor Changes

- dd4389b: Let the model edit a large artifact without rewriting it. An artifact tagged `mode="edit"` carries FIND/REPLACE blocks, and the API applies them to the latest version of that artifact when the turn finishes, storing and sending the full updated artifact. Each FIND must match exactly once. While a reply streams the thread shows that the artifact is updating, and an edit that cannot be applied is reported rather than rendered.
- dd4389b: Let React artifacts show live data and charts. An artifact can declare read-only connector reads in a leading `<bindings>` block and read them with `usePolychatData` from `@polychat/data`. The host runs each read through the API, which takes the declaration from the stored message, refuses operations that change anything, only lets a refetch change declared arguments, caches results for a minute and rate-limits each artifact. React artifacts now compile with Sucrase instead of Babel standalone, can import `recharts`, and are assembled without string replacement, so `$` sequences and `</script>` in component source no longer corrupt the page.
- 1e5cafb: Let `ask_user` ask for a file. A question can set `requestsFile`, the question card offers an "Attach a file" button for it, and the chosen files are uploaded with the same model rules as composer attachments and sent with the answers.
- 462cbe7: Queue follow-ups while a Chat reply is running. The composer stays open during a reply and queues what you type, up to ten messages per conversation, listed above the composer and removable. Queued messages are held as suspended `queued_chat_message` tasks and the next one is released when the run ends, so they send in order even after the tab closes. Work keeps steering the run instead.

### Patch Changes

- b4c0c65: Add user feedback capture to telemetry. `captureAiFeedback` fans thumbs feedback out to a new AI Gateway sink that patches the stored log (when the message has a log id) and to PostHog as a survey response linked to the chat run trace that produced the message. Provider generation events now use the chat run as `$ai_trace_id` (falling back to the conversation) so feedback and generations link in AI Observability. The chat feedback endpoint accepts a `message_id`, resolves the message, run id, log id and trace id on the backend, and attributes feedback to the latest assistant message when clients send only the conversation. The frontend sends the message id and always shows feedback prompts on assistant messages.
- ac1b6d6: Replace browser pop-ups with in-app dialogs and toasts, and stop Attention showing Chat users a Work sales page.

  - Renaming a conversation in the Chat or Work sidebar opens a shared `RenameConversationDialog` instead of `window.prompt`, and rename, upload and history-export failures show a toast instead of `window.alert`.
  - Attention shows everyone signed in their background tasks. Workspace attention and the task inbox stay Pro-only, and non-Pro users see a short note pointing at Work instead of the full `WorkAccessEmptyState` panel.
  - The Workspaces page no longer repeats the notification inbox that Attention already shows; it shows an unread count linking to Attention.

- 5deae3a: Give pending work and failures a Polychat feel: a glowing pending card for slow generations, shimmering activity labels, a progress line while artifacts are written, and a short ruffle on failures, all respecting reduced motion.
- 57f8a16: Add Sites, a generative site builder that works from one brief. Jev classifies the brief into a plan (kind, scope, tone, palette, model tier), a tier-selected coding model streams the site as JSON Patch lines against a guardrailed component catalogue, and the shell renders every patch the moment it lands. `library-sites` holds the catalogue, patch stream compiler, validator and repair, prompt assembly, theme tokens and a deterministic Next.js and Tailwind code generator; `component-sites` holds the live React registry, themed preview and code view. Sites persist as revisioned outputs, refine in follow-ups, export as runnable project files, and hand off to a project's sandbox for a full build. The SSE buffer parser now lives once in `utility-core`. Sites are interactive (state, bindings, visibility, repeat, filters and actions in both the live renderer and the generated code), editable in place through an element inspector with zero-token edits and scoped refinement, exportable straight to a pull request with generated images, embeddable in chat through the `build_site` tool, revisioned with restore and public preview links, and judged by Jev at planning, refinement, quality-scoring and prompt-evaluation time.
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
  - @ngriffin_uk/polychat-schemas@1.2.0
  - @ngriffin_uk/polychat-utility-core@0.3.0
  - @ngriffin_uk/polychat-library-client@0.3.0
  - @ngriffin_uk/polychat-library-chat@1.1.0
  - @ngriffin_uk/polychat-component-content@1.1.0
  - @ngriffin_uk/polychat-library-react@0.4.0
  - @ngriffin_uk/polychat-component-navigation@0.4.0
  - @ngriffin_uk/polychat-component-ui@0.4.0
  - @ngriffin_uk/polychat-utility-react@0.3.0
  - @ngriffin_uk/polychat-component-experiences@0.4.0
  - @ngriffin_uk/polychat-component-models@1.1.0
  - @ngriffin_uk/polychat-library-goals@0.1.1
  - @ngriffin_uk/polychat-library-realtime@0.1.2

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
