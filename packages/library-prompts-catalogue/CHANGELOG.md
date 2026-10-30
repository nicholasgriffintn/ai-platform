# @ngriffin_uk/polychat-library-prompts-catalogue

## 0.9.0

### Minor Changes

- 2a427dd: Teammates now carry your corrections into every run. When you have told a teammate to stop doing something, or to do it differently, that rule is placed in front of it on its next task, delegation, routine or channel reply, most repeated first and with your own words beside it. Rules that apply to one teammate stay with that teammate, and a rule only changes how it works, never what it is allowed to do.

## 0.8.2

### Patch Changes

- 36500dd: Memories now keep the words they came from. Each new memory records a quote from your message and the chat it was in, and the memory's version history in Files shows it beside each change. Ask Polychat why it remembers something and it can answer with the quote.

  You can also bring your memory over from another assistant. In Files, start a new memory and choose Bring memory over from another assistant. Drop in a ChatGPT or Claude export (every .zip part Claude sends, or the conversations.json) or paste what Gemini, Meta AI or any other assistant knows about you, using the prompt provided. Polychat reads only your side of the conversations in the background and files what will still matter, each with the quote it came from. The export itself is not kept.

## 0.8.1

### Patch Changes

- cc332ae: Discover research finds news again when your chosen web search cannot search by date: news lookups now use a search service that can. Discover now keeps an Interests document in your Discover notebook that lists what you keep coming back to and the activity that shows it, so research builds on the same interests instead of picking new ones every day. Today's edition gains fresh feed items through the day, and Discover gathers again before the evening edition. Editions leave out topics you hid, news older than yesterday and stale memories, and read only real newsletters from Gmail.
- b85014a: Pages Discover reads for you now show when they will be removed: a week for articles and a month for links filed into notebooks you follow. Saving or opening the card keeps the page. Knowledge documents now get a sensitivity when they are read, including a new Public level for published pages, and anything you set yourself is left alone. Administrators can see every account's queued, running and failed background work under Profile, Background tasks.

## 0.8.0

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

- 810eff4: Work now runs on tasks instead of chats. Teammates manage the work between them: they assign each other, ask for review, escalate, raise cases and propose hires.

  - **Projects open on their tasks.** Each task has a key such as BIL-41, an owner, a priority, a due date and a thread. Switch between List, Board, Tree, Timeline and Triage views. Type a request into the box at the top and the project's lead routes it. Your old project conversations are now done tasks, with their history kept.
  - **One memory per workspace.** A teammate employed in a workspace keeps one working memory and one set of connection grants across all its projects, carried over from what it already knew in each project.
  - **Tasks run where their owner runs.** A task follows its teammate's model onto Polychat, the sandbox or one of your machines. If that place can't take it, such as a machine that's offline, a sandbox with no repository or a provider that isn't ready, the task waits and says why instead of failing part way. Machine tasks start by themselves when the machine checks in.
  - **Big tasks split into sub-tasks.** A teammate proposes how to break its task down, with owners and the order things must happen in. Once its manager or you accept that revision, the sub-tasks are created with their blockers and the ready ones start.
  - **Teammates hand work to each other.** A teammate can split a task into sub-tasks, assign them to other teammates, ask someone to review, block a task on the person who can unblock it, and escalate up its reporting line. Everything it does runs on the authority of the person responsible for it.
  - **The lead handles the team's questions first.** When a teammate gets stuck on a question or a failed run, its manager looks at it before you do. It answers what it can from the mission, the plan and earlier answers, sends work back to run again, and only comes to you with one combined request for what it genuinely can't know. Approvals and spending still come straight to you.
  - **Mention a teammate to wake it.** Write @name in a task thread and that teammate picks the task up. Teammates also wake when they're assigned work, asked to review or unblocked, and on their own heartbeat if you give them one.
  - **Team page.** See who reports to whom, where each teammate runs, how often it wakes and what it has spent this month. Heartbeat rails show when each teammate ran, what it is running now and where it got stuck.
  - **Budgets that brake.** Give each teammate a monthly budget. Inbox warns you at 80%, and at 100% the teammate pauses until you raise its cap.
  - **Hiring by proposal.** You or a teammate can propose a hire with a reason, a manager and a budget. Owners and admins approve or reject it in Inbox.
  - **Cases.** Problems found by people, by teammates or in imported issues land in a project's Triage, linked to the tasks that fix them. A case closes itself when those tasks are done.
  - **Channels and email can open cases.** Connect a Slack channel, Telegram chat or email address to a project and choose "Open a case in Triage". Each new thread becomes a case that records who wrote in, and follow-ups in the same thread join it. The teammate drafts a reply, and you read, edit and send it from the case.
  - **Standups.** Turn on a standup in project settings and pick the days, time and questions. Each standup is a task: you answer in Inbox from a draft built from your own activity, teammates answer from theirs, and the lead posts a summary, which can also go to a connected channel. Skip a day with one click, or pause standups until a date for holidays.
  - **Initiatives.** Set your workspace's mission and initiatives, link projects to them and watch progress add up from their tasks. Teammates see why their work matters when they run. The lead reviews the initiatives every week and can write you a daily brief, on the days and times you choose on its page.
  - **One Inbox.** Hires, budget warnings, standups, escalations, setup plans, approvals, teammates waiting on you and tasks handed to you sit in a single list, newest decisions first. Cases stay in Triage. My tasks lists everything you own or are responsible for across workspaces.
  - **Find tasks with ⌘K.** Search now finds tasks by key, such as BIL-41, or by what they're about.
  - **Unstick a task.** If a queued or running task stops moving, open it and choose "Send to the queue again" from its menu.
  - **Costs and Activity.** Each workspace shows spend by teammate, initiative, project and task for the period you pick, and a feed of everything people and teammates did. Usage and the audit log moved here from settings.
  - **Setup works with what you've connected.** The setup plan only uses services you've already connected, and gives each project read or read-and-write access as it needs. Anything else the lead thinks would help is listed as a suggestion you can connect in Plugins, never a task.
  - **New workspace starts with a lead.** Give the workspace a name, a mission, links the lead can read and a monthly budget. The lead proposes a setup plan covering projects, team, budgets, wake rules, standups and first tasks, and nothing starts until you approve it. If anything fails while the plan is applied, nothing it made is kept and the plan shows why. Existing workspaces can hire a lead from the Team page. Edit the plan yourself before approving it, or save a running team as a template and start the next workspace from it.
  - **Inbox on iPhone.** Approve hires and setup plans and answer standups from Inbox on iOS.

### Patch Changes

- 0af6a2b: Discover researches the day's topics before it talks about them, and Reading keeps every useful link.

  - **Research first.** Before The Perch and today's episode are written, Poly reads the full articles behind each topic the edition covers, searches wider around the lead stories and writes a briefing: what happened, how it got here, why it matters, the different views and what comes next.
  - **Deeper conversations.** The Perch is now a ten minute conversation that goes deep on the two or three topics with the most to say, instead of a quick run through headlines. Neither The Perch nor the episode comments on scores, points or what an article does or doesn't say.
  - **Researching, then recording.** Asking for The Perch queues the research first, and the player shows Researching until the recording starts.
  - **Every useful link.** Reading no longer stops at six links or two per topic. After Poly's own picks it keeps every fresh link found for the day, with the topics the edition covers first, then the day's headlines and your services' feeds, and the same story only once.
  - **Research adds to Reading.** Pages Poly reads while researching a topic join Reading next to that topic's other links, unless an earlier edition already showed them.

## 0.7.0

### Minor Changes

- 5d70d5d: Everything you give Polychat is now read, filed and searched the same way, whichever door it came in by.

  - **See what Poly knows about a file.** Open any file and choose Knowledge to see where it came from, whether it is searchable yet, its summary and topics, which files it cites, repeats or was made from, and anything that failed with a button to read it again.
  - **Decide how each file is used.** Turn off Use in answers to keep a file without Poly or teammates quoting it, let followed pages remove themselves after a week, a month or three, and mark a file confidential so teammates never see it.
  - **Topics that file themselves.** New files are filed under topics and the people, places and projects they are about. Open a topic from a file's Knowledge panel to see everything filed under it.
  - **Follow a connected service, item by item.** In a project's Files, choose Follow, then A connected service, to follow a Notion database, Google Docs in Drive, a Gmail search, a Slack channel, GitHub issues, Linear issues or a Jira search. Each page, email, message or issue arrives as its own file, unchanged items are skipped, and anything removed upstream is archived.
  - **Search your knowledge bases too.** Connect Cloudflare AI Search or Amazon Bedrock Knowledge Bases in Plugins and Poly can search them alongside your files without copying them in. Project owners and admins can attach their connection to a project under Follow, How new files are read.
  - **Choose how new files are read.** Summaries, topics and related-file links can each be turned off for your library or a project under Follow, How new files are read.
  - **Finished work is findable.** Documents, decks and sheets Polychat made are searched alongside your sources, and search can be narrowed by kind, origin, topic, folder or date.
  - **Documents in global search.** Search now finds files in your library as well as chats and projects.
  - **Long files no longer slow anything down.** Very long files are kept in file storage and indexed in full, however long they are.
  - **Webhooks for knowledge.** Webhook endpoints can subscribe to files being filed, updated, removed or read through.

## 0.6.0

### Minor Changes

- 11dabe3: See how the news is framed before you trust it.

  - **How it's framed.** A Discover read has a How it's framed button. It shows the article's slant and tone, who it relies on, any loaded wording (quoted exactly as written) and what it leaves out, plus a writing grade. It is kept with the article, so opening it again costs nothing.
  - **Compare the coverage.** A Discover topic with two or more articles that day can compare them: what every outlet agrees on, each outlet's angle, where they differ and what none of them mention. The comparison is filed in your Discover notebook.
  - **Article analysis speaks the same language.** Article analysis in Apps now uses the same framing check, so its reports describe framing and omissions rather than labelling pieces left or right.
  - Both count towards your monthly Discover budget and stop when it is spent.

- ed38a63: Wind down is no longer the same session every night.

  - **Tonight's pick.** Opening Wind down suggests one session from your day, last night's sleep and what you played recently, ready to start in one tap. It never suggests the same kind or sound two nights running.
  - **About your day.** Unwind names a few real things from today and sets them down. Turn off Mention my day when others can hear. Apple TV always leaves your day out.
  - **New kinds.** A slow story where nothing much happens, carried on over up to five nights; your Readwise highlights read back slowly; Park tomorrow, where what's on your mind comes back as things worth doing in the next edition; and Just the sound, with no voice at all. Sessions can now run to 30 minutes.
  - **Tonight's story in Worth a look.** Evening editions can offer a story on a topic you follow. It's only recorded when you tap it.
  - **Sound and voice.** One slider moves between the sound and the voice, and Sound after keeps the sound going for 15, 30 or 60 minutes after the voice ends. Pick the sound yourself (night, rain, sea, embers or aurora) or leave it to Poly. Sounds now crossfade as they loop and fade in and out when you play or pause.
  - **Animated scenes.** Each sound has its own slow scene, with tonight's real moon, on the web, iPhone and Apple TV.

## 0.5.0

### Minor Changes

- e0ca7c6: Memories are kept as whole documents, and what Polychat gathers is summarised rather than pasted.

  - **One document per subject.** When Polychat remembers something with document memory, it files it into the memory document for that subject, or starts a new one, instead of adding a line to a single list. The whole document is rewritten each time: what to remember, why, and how it should shape future answers, with links to related memories. A newer fact replaces the one it contradicts.
  - **Memories say what they hold.** Each memory document has a one-line description and a kind: about you, how to work with you, ongoing work, or where to find things. Poly picks memories by those descriptions, and you can see them under File info.
  - **Summaries for gathered reading.** Pages Discover reads and the browsing your Mac shares are recorded with a summary of what each page says and its key points, rather than its opening lines. Discover keeps the whole page in its notebook. Documents also get a summary when they are added or change, so when a notebook is too big to read in full, guides, Studio and episodes get a summary of every source instead of only the first few.
  - **Service documents are easier to read.** Each service's document in the Discover notebook lists what was found without the raw response underneath.

### Patch Changes

- 0fe409a: Activity shared from your Mac now keeps a week of days, so Poly can answer what you were doing on Tuesday. Your recent searches lead what Poly sees, Discover stops suggesting pages you have already opened, and activity from a Mac that has gone quiet stops counting after a few days. The desktop app now sends once an hour.

## 0.4.0

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

- 8b965f6: Conversation groups are now notebooks. Click a notebook's name in the sidebar to open it: your sources on the left, the chat in the middle and Studio on the right. Every chat in a notebook answers from the sources you tick, names the source behind each claim, and can search the notebook's earlier chats too.

  - Add sources from Files, uploads, web pages or pasted text, or search the web from the notebook. Fast research finds pages to pick from; deep research writes a report in the background and brings back the pages it cites.
  - Studio makes audio overviews, slide decks, video overviews, mind maps, reports, flashcards, quizzes, infographics and data tables from the ticked sources. The pencil on each tile lets you choose the format, length, style, language and focus.
  - Flashcards and quizzes remember how you got on. Click any topic in a mind map to ask about it.
  - Save any reply as a note, and turn a note into a source when you want chats to read it.
  - Configure a notebook to answer as a learning guide or a persona of your own, at the length you like, from its sources only or with the web as well.

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

- 91c7d3d: Choose how the assistant responds without writing a prompt.

  - **Style controls.** Personalised responses now has dropdowns for base style and tone (Professional, Friendly, Candid, Quirky, Efficient, Nerdy or Cynical), warmth, enthusiasm, emoji, and headers and lists. Leave any on Default to keep the assistant's usual behaviour.
  - **Custom instructions on top.** Your own traits and preferences sit below the controls and are added to the style you pick, so you can choose a tone and still add anything the controls do not cover. Instructions you have already written carry on working unchanged.

- 7b36da1: Sources is now where your media lives. Files' Given tab is renamed Sources and gains Podcasts, Image Studio and Replicate alongside the library.

  - Upload images, audio and video straight into Sources. Open any audio or video source to play it, transcribe it, write notes with decisions and action items, and make cover art. The transcript becomes searchable, so recordings work as grounding like any other source. This replaces the Recording Processor app.
  - Image Studio, sketch-to-painting and Replicate runs now save what they make into Sources, where it can be reused as material. They have moved out of Apps and the Canvas sidebar item into Files › Sources.
  - Make podcasts from your sources: pick sources, a format (deep dive, brief, debate or critique) and a length, and two hosts talk it through. Each episode lands in Sources with its audio, transcript, show notes and cover.
  - Group episodes into shows and create a private RSS feed link to subscribe in any podcast app. Making a new link turns off the old one.
  - Ask Poly or a teammate to make an episode with the new podcast tool, or install the Podcast Briefing recipe to get a fresh episode on your topics or Sources on a schedule.

## 0.3.0

### Minor Changes

- 7e757d4: Attached documents that would take more than three quarters of the model's context window are replaced with a digest instead of failing the message. Each 50,000-character part is summarised in parallel with the auxiliary model, an overview is built from those summaries, failed parts are named rather than dropped, and complete digests are cached per user by content hash.
- 65fbf81: Refresh the realtime providers and Note Taker. Notes dictation now runs on the shared live session with any ready transcription provider and commits OpenAI turns on silence. Gemini Live defaults to Gemini 3.8 Live, OpenAI transcription sends the `languages` field and drops the retired Whisper and GPT-4o models, translation sessions use the dedicated translations endpoints, and proxied transcription sessions settle billing on their measured audio instead of a flat reservation. The proxy audio cap now covers the full session length, Notes lists return excerpts with server-side search, metadata is only described once a note has enough text, and the unused video analysis options are gone.
- b97c227: Recording summaries now come from the auxiliary model as structured notes: a summary, the decisions and the action items with owner and due date when the recording states them. In a project, each action item can be added to the task board.

### Patch Changes

- 04c071a: Sites browser verification now fails a Hero that runs past the first desktop screen and copy that touches the screen edge on mobile, and the site prompt asks for a Hero that fits the first viewport.
- e41549c: Keep transcription timings. Providers return segments and words, `/audio/transcribe?timestamps=true` includes them, notes from media quote real `[m:ss]` markers instead of guessing, and recordings play captions and download them as SRT or VTT.

## 0.2.0

### Minor Changes

- 33133cc: Centralise every authored prompt in a catalogue and a retrieval package. `library-prompts-catalogue` holds all prompt text and fragments as data with a validating schema, variables and conditionals; `ai-prompts` retrieves entries by id, task or variant, renders `{{variable}}` templates, and composes the chat, meta-assistant, sandbox, memory, document, agent, sandbox-worker, provider and panel prompts. Hardcoded prompts are removed from `ai-providers` (image styles and guardrail policies), `ai-functions` (task system prompts), `ai-agents`, `schemas` (council member prompts, teammate and platform teammate briefs) and the API and sandbox worker services, which now source their text from the catalogue.
- d25fd94: Let people reach Polychat by email. A personal email binding is keyed by the address you write from, linked with the usual one-time command, and answered by threaded plain-text replies. Inbound mail arrives through the Worker email handler and is only accepted when a DKIM signature aligned with its From domain also covers the To or Cc header naming Polychat's inbox, so forged senders and replayed messages are refused. Auto-replies are ignored to avoid loops.
- 462cbe7: Stop saving blank assistant replies. When a model finishes a step with no visible text and no tool calls, the agent loop retries the request once, then asks for a tool-free answer from what the conversation already holds, and finally writes a plain notice if both come back empty. Every attempt's usage is billed with the turn, and empty replies are logged as `empty_model_response`.
- 67b52ed: Give Poly an agenda. `GET /poly/agenda` derives what needs the person, what Poly is working on and what it finished this week from the Poly thread's delegations, goal and latest run, with no new storage. Poly's prompt carries the agenda each turn, the overlay shows it above the thread, and the sidebar's Ask Poly button shows Poly's status. The agenda refreshes on the live delegation, goal and run events for the Poly thread.
- 67b52ed: Budget Poly's interruptions. Routines Poly sets up from its thread now report back to it, and each routine result passes through a judged, budgeted handoff before it reaches the person: results waiting on them always interrupt, failures and results a decision policy rates as urgent interrupt within five a day and thirty minutes apart, and everything else is noted quietly. Each occurrence is decided once and recorded as a `poly.handoffs` activity on the Poly thread, and the agenda, Poly's prompt and the overlay list what was noted and why.
- ee31a6d: Make Poly a platform teammate with one continuous thread per person. `POLY_TEAMMATE` is synced like the other platform teammates but kept out of rosters, `GET /poly/home` opens the person's Poly context and its `poly` home conversation, and the overlay always opens that thread through the Poly teammate. Poly runs only in its owner's thread, a Poly thread only runs as Poly, and navigation tools are offered only on turns the person started.
- ee31a6d: Call the Poly by its name everywhere. The `meta` conversation type is now `poly`, the `meta_assistant` request field is now `poly`, and the meta assistant contracts, prompts, tools, hooks and overlay are renamed to match (`POLY_NAVIGATION_TOOL_NAMES`, `polyRequestSchema`, `buildPolyPrompt`, `PolyOverlay`, `usePolyNavigation`). A data migration moves stored `meta` conversations to `poly`. Behaviour is unchanged.
- ee31a6d: Let Poly do things in its thread. Poly's grants now cover delegation, goals, memory, research, documents, notes, skills and automations alongside navigation, its thread uses the standard chat prompt with its persona and memory, and `buildStandardChatPrompt` takes a `poly` option that adds Poly's behaviour and the person's current place. `buildPolyPrompt` is removed.
- 57f8a16: Add Sites, a generative site builder that works from one brief. Jev classifies the brief into a plan (kind, scope, tone, palette, model tier), a tier-selected coding model streams the site as JSON Patch lines against a guardrailed component catalogue, and the shell renders every patch the moment it lands. `library-sites` holds the catalogue, patch stream compiler, validator and repair, prompt assembly, theme tokens and a deterministic Next.js and Tailwind code generator; `component-sites` holds the live React registry, themed preview and code view. Sites persist as revisioned outputs, refine in follow-ups, export as runnable project files, and hand off to a project's sandbox for a full build. The SSE buffer parser now lives once in `utility-core`. Sites are interactive (state, bindings, visibility, repeat, filters and actions in both the live renderer and the generated code), editable in place through an element inspector with zero-token edits and scoped refinement, exportable straight to a pull request with generated images, embeddable in chat through the `build_site` tool, revisioned with restore and public preview links, and judged by Jev at planning, refinement, quality-scoring and prompt-evaluation time.
