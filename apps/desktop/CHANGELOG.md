# @assistant/desktop

## 0.6.4

### Patch Changes

- 701256c: Claude Code now runs as a proper session in the desktop app, like Codex: replies and steps stream in, tool use asks for your approval, and the conversation keeps its folder and session between messages. Both agents run with your own subscription login, and Polychat warns you when one is signed in with an API key that bills per token. Chats in Polychat on the web can now use the agents on your desktop with the same streaming and approvals. In Settings you can let your workspaces use your desktops, so Work tasks, teammate check-ins and lead routines run with Claude Code or Codex on members' machines instead of spending Polychat credits. Partner teammates work freely inside their workspace folder and only ask when they need to step outside it. Teammates working on someone's desktop can read and update tasks through Polychat, leave that person's own agent instructions out, and a desktop can work on up to three jobs at once. When a task is waiting for your approval, its page now offers Review request, and approving picks the agent up exactly where it paused.
- Updated dependencies [0af6a2b]
- Updated dependencies [766145d]
- Updated dependencies [00f22ad]
- Updated dependencies [afe0236]
- Updated dependencies [701256c]
- Updated dependencies [b91402a]
- Updated dependencies [c79e769]
- Updated dependencies [810eff4]
- Updated dependencies [00f22ad]
  - @ngriffin_uk/polychat-schemas@1.10.0
  - @ngriffin_uk/polychat-component-shell@2.4.0
  - @ngriffin_uk/polychat-component-conversation@2.2.0
  - @ngriffin_uk/polychat-component-models@1.2.5
  - @ngriffin_uk/polychat-library-client@0.9.0
  - @ngriffin_uk/polychat-library-react@0.10.0
  - @ngriffin_uk/polychat-component-experiences@0.7.0
  - @ngriffin_uk/polychat-utility-core@0.9.0
  - @ngriffin_uk/polychat-component-account@1.1.1
  - @ngriffin_uk/polychat-component-ui@0.6.2
  - @ngriffin_uk/polychat-component-content@1.3.4
  - @ngriffin_uk/polychat-component-navigation@0.6.1
  - @ngriffin_uk/polychat-library-chat@1.3.3

## 0.6.3

### Patch Changes

- Updated dependencies [5d70d5d]
- Updated dependencies [8f480ac]
  - @ngriffin_uk/polychat-schemas@1.9.0
  - @ngriffin_uk/polychat-library-client@0.8.0
  - @ngriffin_uk/polychat-library-react@0.9.0
  - @ngriffin_uk/polychat-component-shell@2.3.0
  - @ngriffin_uk/polychat-component-navigation@0.6.0
  - @ngriffin_uk/polychat-utility-core@0.8.0
  - @ngriffin_uk/polychat-component-account@1.1.0
  - @ngriffin_uk/polychat-component-conversation@2.1.3
  - @ngriffin_uk/polychat-component-ui@0.6.1
  - @ngriffin_uk/polychat-component-content@1.3.3
  - @ngriffin_uk/polychat-component-experiences@0.6.3
  - @ngriffin_uk/polychat-component-models@1.2.4
  - @ngriffin_uk/polychat-library-chat@1.3.2

## 0.6.2

### Patch Changes

- Updated dependencies [ce66ee9]
- Updated dependencies [11dabe3]
- Updated dependencies [ed38a63]
- Updated dependencies [48eb3dc]
- Updated dependencies [ed38a63]
  - @ngriffin_uk/polychat-schemas@1.8.0
  - @ngriffin_uk/polychat-component-shell@2.2.0
  - @ngriffin_uk/polychat-library-client@0.7.0
  - @ngriffin_uk/polychat-library-react@0.8.0
  - @ngriffin_uk/polychat-utility-core@0.7.0
  - @ngriffin_uk/polychat-component-ui@0.6.0
  - @ngriffin_uk/polychat-component-account@1.0.2
  - @ngriffin_uk/polychat-component-conversation@2.1.2
  - @ngriffin_uk/polychat-component-content@1.3.2
  - @ngriffin_uk/polychat-component-models@1.2.3
  - @ngriffin_uk/polychat-component-navigation@0.5.2
  - @ngriffin_uk/polychat-component-experiences@0.6.2
  - @ngriffin_uk/polychat-library-chat@1.3.1

## 0.6.1

### Patch Changes

- 7c43bd8: The desktop app now shows Discover covers and episode artwork, plays episode and wind-down audio, and opens files in the viewer. Check for updates now finds new releases instead of saying it couldn't fetch them.
- Updated dependencies [7c43bd8]
- Updated dependencies [6db0566]
- Updated dependencies [e69d886]
  - @ngriffin_uk/polychat-library-client@0.6.1
  - @ngriffin_uk/polychat-utility-core@0.6.1
  - @ngriffin_uk/polychat-component-shell@2.1.1
  - @ngriffin_uk/polychat-library-chat@1.3.0
  - @ngriffin_uk/polychat-schemas@1.7.0

## 0.6.0

### Minor Changes

- 1212c26: The desktop app now updates itself. It looks for a newer release when it opens and every few hours while it stays open, downloads it quietly in the background, then asks whether to restart. Choose Later and it won't ask about that version again until you next open Polychat. To look straight away, choose Check for updates from the Poly menu.

## 0.5.0

### Minor Changes

- 0fe409a: The desktop app can share what you do on your Mac with Discover and Poly.

  - **Choose what to share.** Open Profile, then Mac activity, in the desktop app and switch on any of: browsing in Helium, Chrome, Brave, Arc, Edge, Vivaldi or Chromium; Claude Code and Codex sessions; time in the apps you use; and what Apple Music or Spotify played. Everything starts off.
  - **Summaries leave, files don't.** The Mac reads history and transcripts itself and sends summaries, never the files: short lines such as a site with your visit count and time spent, or a project with its session title and prompt count. Searches and window titles each have their own switch.
  - **Discover knows what you read and worked on.** With "Include the pages you read" on, the Mac also sends the pages you spent longest on, and Discover reads the public ones so the edition can say what they were about rather than only naming them. With "Include what each session was about" on, each Claude Code or Codex session carries your first and latest prompt and the agent's last reply.
  - **Pause from the menu bar.** The Poly menu says what's being shared and lets you pause for an hour, until tomorrow or until you resume. Anything you did while paused is never sent, even after you resume.
  - **See exactly what was sent.** The settings tab shows the last send line by line. Mark any site, app or project as never shared, or forget everything this Mac sent.
  - **Discover and Poly use it straight away.** Each source appears in the Discover notebook as a document for your Mac, so morning editions and Poly's sense of your week include it. Switch a Mac source off in Discover settings to stop using it there.

### Patch Changes

- 0fe409a: Activity shared from your Mac now keeps a week of days, so Poly can answer what you were doing on Tuesday. Your recent searches lead what Poly sees, Discover stops suggesting pages you have already opened, and activity from a Mac that has gone quiet stops counting after a few days. The desktop app now sends once an hour.
- Updated dependencies [187afde]
- Updated dependencies [d2905a6]
- Updated dependencies [0fe409a]
- Updated dependencies [0fe409a]
- Updated dependencies [e0ca7c6]
- Updated dependencies [e0ca7c6]
  - @ngriffin_uk/polychat-schemas@1.6.0
  - @ngriffin_uk/polychat-utility-core@0.6.0
  - @ngriffin_uk/polychat-component-shell@2.1.0
  - @ngriffin_uk/polychat-library-client@0.6.0
  - @ngriffin_uk/polychat-library-react@0.7.0
  - @ngriffin_uk/polychat-component-account@1.0.1
  - @ngriffin_uk/polychat-component-content@1.3.1
  - @ngriffin_uk/polychat-component-conversation@2.1.1
  - @ngriffin_uk/polychat-component-experiences@0.6.1
  - @ngriffin_uk/polychat-component-models@1.2.2
  - @ngriffin_uk/polychat-component-navigation@0.5.1
  - @ngriffin_uk/polychat-component-ui@0.5.1
  - @ngriffin_uk/polychat-library-chat@1.2.1

## 0.4.0

### Minor Changes

- 8b2929f: Confirm your date of birth before your first message.

  - **Asked once, at the right moment.** The first time you send a message, signed in or not, on the web, desktop or iPhone, Polychat asks for your date of birth. It keeps only whether you meet the minimum age of 18, never the date, and the answer can't be changed later.
  - **Skip if you're just looking.** Skip the question and you can keep browsing, but you can't send messages until you answer it. Polychat asks again the next time you try to send one.
  - **Why we ask.** A new page at `/age-check` explains why we ask, what we keep and your rights in the UK and EU. The Terms of Service and Privacy Policy now say plainly that Polychat is for people aged 18 or over.
  - **Same rule on the API.** Creating a response, sending input to one and calling chat completions all return 403 until the age check is done, for API keys and anonymous sessions alike. Read or record it with `GET` and `POST /auth/age`.
  - **Self-hosting.** Set `AGE_GATE_ENABLED` to `false` in your Worker vars to turn the check off completely.

- b3e3ea2: Poly can now work inside folders you grant on Polychat Desktop. Grant a folder in the desktop app and any chat or teammate can list, search, read and write files there with the new desktop tools, as long as the desktop is online. Reads happen without ceremony; writes go through the usual approval and autonomy rules, and nothing outside a granted folder is reachable.
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

- abf8eb7: A rebuilt iPhone app, and approvals that go back together.

  - **Four tabs on iPhone.** Home shows your Discover edition, morning or evening, with the brief, topics, links and the episode, The Perch, your week and wind down, each with its real status and artwork. Chats has a Chat and Work toggle for your own conversations and your projects. Attention gathers approvals, questions, reviews, your inbox and background tasks, with a badge on the app icon. Settings covers your account, default model, Discover, Apple Health and notifications.
  - **Replies stream properly on iPhone.** Text arrives as it is written, each step of a reply that uses tools shows in order, chats open at the latest message, and headings, lists, quotes, code and tables render the way they do on the web.
  - **iPhone keeps up with your other devices.** Conversations, running work and Attention update live when something changes on the web or desktop.
  - **Widgets show what's happening.** The Today, Attention and Poly widgets come in small, medium and large sizes and on the Lock Screen, with the latest edition, what's waiting on you and what Poly is working on.
  - **Approvals arrive as one set.** When Poly asks for several approvals at once, decide each one (or approve or reject the rest in one go) and Polychat sends every decision together once the set is complete, so Poly carries on with all of them rather than one at a time. This works on the web, desktop and iPhone.
  - **Voice and Apple Health from iPhone.** Dictation and the Apple Health switch work again from the app.

- 7b5038c: The desktop app can share what you do on your Mac with Discover and Poly.

  - **Choose what to share.** Open Profile, then Mac activity, in the desktop app and switch on any of: browsing in Helium, Chrome, Brave, Arc, Edge, Vivaldi or Chromium; Claude Code and Codex sessions; time in the apps you use; and what Apple Music or Spotify played. Everything starts off.
  - **Lines leave, files don't.** The Mac reads history and transcripts itself and sends only short summary lines, such as a site with your visit count and time spent, or a project with its session title and prompt count. Page titles, searches, window titles and first prompts each have their own switch.
  - **Pause from the menu bar.** The Poly menu says what's being shared and lets you pause for an hour, until tomorrow or until you resume. Anything you did while paused is never sent, even after you resume.
  - **See exactly what was sent.** The settings tab shows the last send line by line. Mark any site, app or project as never shared, or forget everything this Mac sent.
  - **Discover and Poly use it straight away.** Each source appears in the Discover notebook as a document for your Mac, so morning editions and Poly's sense of your week include it. Switch a Mac source off in Discover settings to stop using it there.

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

- 7b36da1: Sources is now where your media lives. Files' Given tab is renamed Sources and gains Podcasts, Image Studio and Replicate alongside the library.

  - Upload images, audio and video straight into Sources. Open any audio or video source to play it, transcribe it, write notes with decisions and action items, and make cover art. The transcript becomes searchable, so recordings work as grounding like any other source. This replaces the Recording Processor app.
  - Image Studio, sketch-to-painting and Replicate runs now save what they make into Sources, where it can be reused as material. They have moved out of Apps and the Canvas sidebar item into Files › Sources.
  - Make podcasts from your sources: pick sources, a format (deep dive, brief, debate or critique) and a length, and two hosts talk it through. Each episode lands in Sources with its audio, transcript, show notes and cover.
  - Group episodes into shows and create a private RSS feed link to subscribe in any podcast app. Making a new link turns off the old one.
  - Ask Poly or a teammate to make an episode with the new podcast tool, or install the Podcast Briefing recipe to get a fresh episode on your topics or Sources on a schedule.

### Patch Changes

- abf8eb7: Polychat keeps you signed in while you use it.

  - **Sessions renew as you go.** Signing in used to last seven days from the moment you signed in, however much you used Polychat in between. A session now extends itself each day you use it on the web or the desktop app, and only lapses after a week away.
  - **The desktop app no longer signs you out in the background.** Waking the Mac with no connection, or a brief network drop, used to leave the app looking signed out. It now waits for the connection and carries on, and only shows the sign-in screen when your session has actually ended. Signing in again reuses the session the app already holds before asking you to go through the browser.

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
  - @ngriffin_uk/polychat-component-shell@2.0.0
  - @ngriffin_uk/polychat-component-account@1.0.0
  - @ngriffin_uk/polychat-component-models@1.2.1
  - @ngriffin_uk/polychat-component-ui@0.5.0
  - @ngriffin_uk/polychat-component-content@1.3.0
  - @ngriffin_uk/polychat-component-conversation@2.1.0
  - @ngriffin_uk/polychat-library-chat@1.2.0
  - @ngriffin_uk/polychat-component-experiences@0.6.0
  - @ngriffin_uk/polychat-component-navigation@0.5.0

## 0.3.1

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
  - @ngriffin_uk/polychat-component-shell@1.2.0
  - @ngriffin_uk/polychat-component-models@1.2.0
  - @ngriffin_uk/polychat-component-account@0.3.0
  - @ngriffin_uk/polychat-component-content@1.2.0
  - @ngriffin_uk/polychat-component-experiences@0.5.0
  - @ngriffin_uk/polychat-component-conversation@2.0.1
  - @ngriffin_uk/polychat-component-navigation@0.4.1
  - @ngriffin_uk/polychat-component-ui@0.4.1
  - @ngriffin_uk/polychat-library-chat@1.1.1

## 0.3.0

### Minor Changes

- d3f1df3: Canvas is a place, not a mode toggle. Chat and Work sidebars link to it above Files; opening it in Work asks for a project first, like a new chat, and keeps what it makes with that project.
- 5ead2cc: Import GitHub and Linear issues into Work and review exact GitHub PR revisions manually or through signed automatic intake. Retain captured Sources and review Outputs, isolate each workspace and credential owner, and approve publication separately.

  Apply migration `0061_project_task_integrations` before deployment. Configure the GitHub webhook secret and pull-request events for automatic intake, and pull-request write permission for publication.

- 6966643: Grant selected actions from existing connectors directly to projects through Plugins, without creating a recipe. Reuse personal accounts, the connector catalogue, project capabilities and existing execution approvals. Preserve exclusions and narrower recipe permissions.
- d3f1df3: Automations leave the teammates library for their own Scheduled place. The Chat and Work sidebars link to it under Teammates, and the recipe cards, filters, schedule dialogs and deep links move with it.
- 57f8a16: Add Sites, a generative site builder that works from one brief. Jev classifies the brief into a plan (kind, scope, tone, palette, model tier), a tier-selected coding model streams the site as JSON Patch lines against a guardrailed component catalogue, and the shell renders every patch the moment it lands. `library-sites` holds the catalogue, patch stream compiler, validator and repair, prompt assembly, theme tokens and a deterministic Next.js and Tailwind code generator; `component-sites` holds the live React registry, themed preview and code view. Sites persist as revisioned outputs, refine in follow-ups, export as runnable project files, and hand off to a project's sandbox for a full build. The SSE buffer parser now lives once in `utility-core`. Sites are interactive (state, bindings, visibility, repeat, filters and actions in both the live renderer and the generated code), editable in place through an element inspector with zero-token edits and scoped refinement, exportable straight to a pull request with generated images, embeddable in chat through the `build_site` tool, revisioned with restore and public preview links, and judged by Jev at planning, refinement, quality-scoring and prompt-evaluation time.

### Patch Changes

- f933fa8: Keep the desktop app signed in as you. A host can now hand the client its own access-token source, which is always sent as a Bearer token and renewed before a request goes out stale. The desktop window no longer lands as an anonymous free user under `tauri dev`, or after waking from sleep, and drops back to sign-in only when the API rejects the session. A failed network check no longer signs anyone out, and signing out of the desktop app now revokes the server session too.
- ee31a6d: Call the Poly by its name everywhere. The `meta` conversation type is now `poly`, the `meta_assistant` request field is now `poly`, and the meta assistant contracts, prompts, tools, hooks and overlay are renamed to match (`POLY_NAVIGATION_TOOL_NAMES`, `polyRequestSchema`, `buildPolyPrompt`, `PolyOverlay`, `usePolyNavigation`). A data migration moves stored `meta` conversations to `poly`. Behaviour is unchanged.
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
  - @ngriffin_uk/polychat-component-shell@1.1.0
  - @ngriffin_uk/polychat-component-navigation@0.4.0
  - @ngriffin_uk/polychat-component-ui@0.4.0
  - @ngriffin_uk/polychat-component-experiences@0.4.0
  - @ngriffin_uk/polychat-component-models@1.1.0
  - @ngriffin_uk/polychat-component-account@0.2.2

## 0.2.1

### Patch Changes

- 6b0147c: chore: trigger build

## 0.2.0

### Minor Changes

- 4789c96: Let the desktop window tell the operating system when something is waiting on you.

  The web application can only surface Attention while a tab is open and, for background notifications, only through web push behind a service worker. A desktop window is already running, so it can say so directly: it polls Attention every two minutes, raises a system notification for approvals, input requests, reviews and failures it has not announced before, and puts the count of those on the application icon.

  The announcement ledger lives in the desktop's own database, keyed by account, so restarting the application does not repeat a notification and one account's items never appear for another. A backlog of more than three new items collapses into a single notification rather than a queue of them.

  Notifications are raised from Rust rather than granted to the window, so the webview gains no new capability. `library-react` gives `useWorkAttention` an optional polling interval, which the web application does not use.

- 4789c96: Keep the desktop application to one window, and let anything on the machine open a conversation in it.

  Launching Polychat twice started a second process against the same database and the same keychain entry. A second launch now raises the window that is already running instead.

  That window also registers the `polychat://` scheme, so a browser, a terminal, a script or another application can open a conversation directly: `polychat://chat/<conversation-id>` opens that conversation, `polychat://chat/files?tab=made` opens Files. Links arrive as untrusted input, so the window resolves the URL, keeps only the places it actually serves, and refuses anything else rather than navigating; traversal is normalised away by the URL parser and cannot leave the chat root.

- 505ce6a: Give the desktop window every page the web application serves.

  The desktop had the Chat places and nothing else. Work went nowhere, because its connected containers lived in `apps/app` where only the web could reach them, and the same was true of the conversation home, Profile, Models, Discover, Pets, Pricing and the legal pages. The mode toggle, the Discover section and the settings popover all linked to routes the window answered with a 404.

  - The connected Work containers, the conversation home, Profile, Models, Discover, Pets, Pricing and the legal pages moved into `component-shell` beside the Chat places they already shared. `WorkPlaceShell` is the Work frame, reading the workspace and project from the route the way `ChatPlaceShell` reads the Chat place.
  - The desktop registers a page directory for each of them, so every link either host renders now resolves in both.
  - Ask Poly and the project picker moved into a shared `ShellDialogs` the desktop mounts through `ShellHostProvider`, and the desktop drops the throwing placeholder it used for Ask Poly.
  - The desktop wraps its routes in the shared error page, so a render failure explains itself instead of leaving a blank window.
  - `polychat://` links reach Work, Profile and Discover as well as Chat, which is what the attention notifications the window already raises point at.
  - The window title names the open place rather than staying "Polychat".
  - House fonts and built-in pet sheets ship inside `component-ui` and resolve through each host's bundler, replacing the static `/fonts` and `/pets` directory the desktop reached by symlink.

- 4789c96: Give the desktop window the Apps place, and share one app runtime with the web application.

  Apps was the last Chat route the desktop answered with a 404. The runtimes behind it — Notes, Articles, Recordings, Strudel, the image studio, Replicate and fine-tuning — were already thin compositions over `component-experiences` and `library-react`, but the compositions themselves lived in `apps/app` where nothing else could reach them.

  `component-shell` now owns `AppRoute`, `AppRuntime` and every runtime it dispatches to, so both hosts open the same apps from the same code and `/chat/apps/:appId/*` works in the desktop window.

  `component-experiences` declares the `@strudel/*` packages its music surface imports at runtime. They previously resolved only because `apps/app` happened to declare them and pnpm hoisted them into reach; a second consumer would have bundled a broken dynamic import.

- 4789c96: Give the desktop window the Attention place.

  Attention is the second of the three places the shared sidebar links to that the desktop answered with a 404. The page was already built entirely from shared packages, so it moves from `apps/app` into `component-shell` unchanged and both hosts render the same one.

- 4789c96: Give the desktop window the Files place, and share one implementation with the web application.

  Files was one of three places the shared sidebar links to that the desktop answered with a 404. The libraries behind it — sources, outputs and memory documents — already lived in shared packages; only the pages composing them were stranded in `apps/app`.

  `component-shell` now owns `FilesPage` with its Made, Given and Memory libraries, the connected `SignInEmptyState`, the connected `ResponseRenderer`, and `ChatPlaceShell` — the sidebar-and-scroll frame the web chat layout used to spell out inline and the desktop needed to repeat. `SignInEmptyState` asks the shell host to open sign-in rather than reaching for the web login modal, so the desktop opens its own browser sign-in from the same empty state.

- 4789c96: Give the desktop window the Teammates place, the teammate editor and the tool runner.

  Teammates was the last of the three places the shared sidebar links to that the desktop answered with a 404, and it carried the largest tail: the capability library and its dialogs, the recipe workflow controller, the connector setup dialogs and the teammate editor all lived in `apps/app`.

  They move into `component-shell` unchanged, and both hosts render the same library, the same hire, share and skill dialogs, and the same connector setup. `library-react` publishes `NEW_TEAMMATE_ID` beside `getTeammateEditorPath`, so the constant belongs with the paths that use it rather than to whichever page happened to define it.

  The desktop still answers 404 for `/chat/apps/:appId`, which needs the application runtimes rather than the capability library.

- 4789c96: Put the notification inbox on the Attention place, so every host has somewhere to act on a notification.

  Two corrections to the previous change.

  `useTaskInbox` should never have existed: `useTaskAttention` in `library-react` already ran the same query with the same read and dismiss receipts, and already polled. The desktop notifier uses it, and the duplicate is gone. It also polls on its own, so `useWorkAttention` needs no interval option either.

  The claim that the web had no inbox was wrong. It had one, on the Work overview, behind a route the desktop answers with a 404 — which is why the desktop had a badge and notifications with nowhere to go. `AttentionPage` now carries the same inbox, built from the same `TaskAttentionList` the Work overview uses, so both hosts can open, read and dismiss an item from the place their sidebar already links to.

- 4789c96: Let anyone sign out from the shell, and let the desktop window sign out at all.

  The desktop application had a `sign_out` command in Rust that nothing ever called. A signed-in window held its session in the operating system keychain with no way to give it back, so the only way off an account was to delete the credential by hand. On the web, signing out was buried in the profile page.

  The sidebar settings popover now carries a sign-out entry beside the account links, and `ShellHost` gains a required `signOut` so each host does what signing out means for it: the web ends the session through the API, and the desktop ends it through the API _and_ forgets the keychain entry, so a window that cannot reach the API still stops holding the credential.

### Patch Changes

- 4789c96: Let the desktop core build again after the dependency bumps.

  `reqwest` moved to 0.13, which renamed the `rustls-tls` feature to `rustls`. The bump kept the old name, so the crate stopped resolving:

  ```
  package `polychat-desktop` depends on `reqwest` with feature `rustls-tls`
  but `reqwest` does not have that feature
  ```

  Nothing caught it because the desktop workflow is what builds the core, and the bump landed without it running.

- 4789c96: Let the desktop application bundle again.

  `pnpm tauri build --bundles app` — the command the release workflow runs on every platform — failed on macOS:

  ```
  failed to bundle project Failed to create app icon: `No matching IconType`
  ```

  The bundle icon list held three PNGs and no `.icns`, so the macOS bundler had nothing it could turn into an application icon and left an empty `Polychat.app`. Nothing caught it because the desktop workflow is the only thing that bundles, and a broken bundle is not a broken test.

  The icon set now carries `icon.icns` for macOS and `icon.ico` for the Windows installers alongside the PNGs Linux uses, and the configuration names them.

  This was also what stopped the `polychat://` scheme from being verifiable: the scheme is declared in configuration but only reaches the operating system through a built bundle. With the bundle building, `CFBundleURLSchemes` carries `polychat` and Launch Services registers the application as its handler.

- 4789c96: Stop the deep link subscription throwing into nothing when the event bridge refuses.

  `useDeepLinkNavigation` called `listen` and never handled the promise rejecting, so a bridge that could not start the subscription produced an unhandled rejection and the window went on believing it was listening for `polychat://` links. Driving the renderer outside a Tauri window surfaced it as an uncaught `transformCallback` error on every mount.

  Subscribing moved into `subscribeToDeepLinks`, which takes the listener as an argument. It handles a refused subscription, stops listening when the window is done with it even if the subscription resolves after that, and ignores a link that arrives once it has stopped — all of which are now covered by tests that need neither a browser nor the bridge.

- 4789c96: Announce the desktop's notifications from the task inbox the iOS application already uses, rather than a poller of its own.

  The first pass built a parallel system: it polled Work Attention, decided for itself which kinds were worth announcing, and kept its own idea of what counted as unread. Polychat already has a task notification system — a server-side inbox with read receipts, dismissal, per-item deep links and per-category preferences — and the iOS client consumes it through `TaskNotificationManager`. The desktop now consumes the same one.

  - `library-react` publishes `useTaskInbox`, the inbox query with its read and dismiss receipts. The web application had no inbox hook at all; only iOS had one, in Swift.
  - `useTaskNotificationSettings` is separated out of `useTaskNotifications`, so a surface can read the account's preferences without dragging web push registration along.
  - `polychat-schemas` publishes `taskNotificationCategoryForAttentionKind` and `isTaskNotificationCategoryEnabled`, so a client gates announcements on exactly the categories the server gates push on, rather than a hand-written list.

  What stays device-local is only what has to be: whether _this_ machine has already put a given item on screen. Announcing is not reading — a notification shown on your Mac must not mark the item read for your phone — so the ledger stays in the desktop's own database while unread, categories and the item list all come from the server.

  The badge now shows the inbox's own unread count. Desktop notifications are not clickable: `tauri-plugin-notification` exposes action handling on mobile only, so acting on an item still means opening the window.

- 4789c96: Let the desktop window discover its pages instead of listing them twice.

  The window kept a route table and a page table side by side, and every place the desktop had not built yet was repeated in a third list so `/chat/:completionId` did not read `/chat/attention` as a conversation. Adding one place meant editing all three.

  A page is now a directory under `src/pages`: `routes.ts` declares the paths it answers and `page.tsx` default-exports what to render. The route table is built from those declarations, and a place still on the unbuilt list stops answering 404 as soon as a page claims its path — so bringing a place across touches only its own directory.

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
  - @ngriffin_uk/polychat-component-content@1.0.1
  - @ngriffin_uk/polychat-component-models@1.0.1

## 0.1.0

### Minor Changes

- 42c36ea: Release the applications from changesets. Merging a changeset that names an application versions it, tags it and publishes a GitHub release with its changelog entry; the desktop release also carries macOS, Windows and Linux archives built on their own runners. The API serves those archives from `/desktop/downloads` and answers the desktop updater from `/desktop/releases`, so neither the website nor the application needs to know where the builds are hosted.
- 7d3c809: Share one connected navigation shell between the web and desktop applications.

  `component-shell` is a new package holding the wiring layer that previously lived only in `apps/app`: the chat sidebar with its conversation list and menus, the product and conversation headers, the page and product shells, global search, the settings popover and the not-found page. It is the single exception to the router-, store- and client-free rule for `component-*` packages, because connecting the controlled presentation in `component-navigation` and `component-ui` to the stores and router is its whole job.

  What differs between hosts arrives through `ShellHostProvider`: the origin public share links point at, the dialogs a host owns alone, and the actions that open them. A host that has not migrated an action supplies one that throws, so a gap stays visible instead of becoming a control that quietly does nothing.

  `library-react` publishes `DISCOVER_PATH` alongside the existing place paths, and `library-client` publishes `WEB_APP_BASE_URL` so a host without a web origin can still build share links.

  `component-conversation` drops `ConversationHeader`. It was the desktop's stand-in for a real header and is replaced by the shared `ConversationProductHeader`.

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
  - @ngriffin_uk/polychat-component-content@1.0.0
  - @ngriffin_uk/polychat-component-experiences@0.2.0
  - @ngriffin_uk/polychat-component-shell@0.2.0
