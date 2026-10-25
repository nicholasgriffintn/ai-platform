# @assistant/api

## 1.4.0

### Minor Changes

- 8b2929f: Confirm your date of birth before your first message.

  - **Asked once, at the right moment.** The first time you send a message, signed in or not, on the web, desktop or iPhone, Polychat asks for your date of birth. It keeps only whether you meet the minimum age of 18, never the date, and the answer can't be changed later.
  - **Skip if you're just looking.** Skip the question and you can keep browsing, but you can't send messages until you answer it. Polychat asks again the next time you try to send one.
  - **Why we ask.** A new page at `/age-check` explains why we ask, what we keep and your rights in the UK and EU. The Terms of Service and Privacy Policy now say plainly that Polychat is for people aged 18 or over.
  - **Same rule on the API.** Creating a response, sending input to one and calling chat completions all return 403 until the age check is done, for API keys and anonymous sessions alike. Read or record it with `GET` and `POST /auth/age`.
  - **Self-hosting.** Set `AGE_GATE_ENABLED` to `false` in your Worker vars to turn the check off completely.

- 8b965f6: Polychat now speaks in the best voice your account can reach. Read-aloud, the speech tool, podcasts and video overviews all pick the highest-rated speech model you have access to, ranked by the Artificial Analysis text-to-speech arena. Add an ElevenLabs, Cartesia, Mistral or Amazon Polly key and your audio upgrades on its own.

  - New speech models: ElevenLabs Eleven v4, v4 Turbo, v3, Multilingual v2 and Flash v2.5, Cartesia Sonic 3.6, Mistral Voxtral 3 TTS and Amazon Polly Generative.
  - Audio settings now separate the provider, the model and the voice. Leave the provider on Automatic, or pick one and choose a model and voice from its list.
  - Podcasts use distinct host and guest voices on every provider, and video overviews use a narrator voice.
  - Notebook guides, Studio outputs and podcast scripts now use the medium model tier on your keys rather than the cheapest background model.

- 91c7d3d: Choose what Polychat can reach for on its own.

  - **Capabilities settings.** A new Capabilities section in Customise Chat has switches for web search and for documents and connected apps. Turn one off and Polychat stops using it by itself, including deep research for web search. Tools you pick in the composer, or that a project, teammate or recipe sets up, still work.
  - **Chat history means chat history.** Searching your earlier chats now follows the chat history switch in Memories. Turn it on if you want Polychat to look back through your previous conversations.

- 7accf45: Pull typed values out of text and images with Cloudflare's Clairic.

  - **Extraction models.** Clairic joins the catalogue as the first extraction model. Give it some text, or up to four images, and a list of named fields, and it returns each one as the type you asked for: a span of the text, a number, a date, a duration, a list, or an estimate or forecast with an 80% range. Anything the input does not say comes back empty with a best guess, never made up.
  - **`POST /extractions`.** Send `state`, `fields` and optional `images` and `reference_date`. Every scalar answer carries `confidence` and `p_null`, so you can decide in code which values to trust.
  - **Extract values tool.** Chat, Poly and automations can call `extract_values` to read order numbers, totals and dates from an email or invoice in one fast call, then hand the values to `decide`.
  - **Paperwork.** A new app for receipts, invoices and damage claims. Drop in photos or paste text, and each figure comes back with a confidence, the source highlighted where it was found, a running total and a CSV export.

- 911642e: Clearer setup for plugins that connect with an API key.

  - **Callback URL.** The connect dialog shows a callback URL you can copy. If the provider asks for a callback or redirect URL when you create the key, paste this one in.
  - **One box per credential.** Plugins that need more than one value now ask for each separately. Podcast Index asks for its API key and API secret, and Audiobookshelf for its server address and API token, so there's no need to join them with a colon or bar yourself.

- bf39c94: Poly can now make slide decks and spreadsheets, not just documents. Ask for a deck or a sheet and it lands in Files, where you can flip through the slides, switch between tables, revise it in conversation and download it as Markdown or CSV. Spreadsheet downloads are safe to open, since text that looks like a formula is kept as text.

  Research now checks your own Sources and synced accounts alongside the web, and shows what it found from them beside the report. Your passages stay with Polychat and are never sent to the research provider.

- b3e3ea2: Poly can now work inside folders you grant on Polychat Desktop. Grant a folder in the desktop app and any chat or teammate can list, search, read and write files there with the new desktop tools, as long as the desktop is online. Reads happen without ceremony; writes go through the usual approval and autonomy rules, and nothing outside a granted folder is reachable.
- 1fe4222: Discover gathers before it writes, and Poly reads your own services without asking.

  - **A Discover notebook.** Before each morning Poly reads your connected services and researches every topic you follow into a notebook called Discover: one document per service and a dated research document per topic. The morning edition is written from those documents, so a slow or broken service never stops the edition. Open the notebook to see what Discover knows.
  - **Every connected service counts.** Discover now picks from the whole connector catalogue by what you have connected: Last.fm, Readwise, Hardcover, Audiobookshelf, Trakt, Marquee, YouTube, Raindrop, DEV, Oura, Google Calendar or Outlook, Gmail or Outlook newsletters, Google Tasks, Todoist or TickTick, Linear, GitHub, Fathom, WakaTime, OpenWeather, Google Photos, NASA and Artificial Analysis. Where two services cover the same thing, the first connected one is used. Each service shows when it was last read, or why it could not be, in Discover settings, where you can also set where you are for weather.
  - **Marquee.** Connect [Marquee](https://marquee.pashi.app) with an API token under Plugins. Poly can read your shelf, what is on tonight and the week ahead, search the catalogue, and, with your approval, save to your shelf or follow a name.
  - **No more approvals for reading your own accounts.** Poly, in your personal space, reads your connected accounts without a separate grant or an approval. Scheduled runs never create approvals; an operation that would need one is left out with a note instead of stalling the run.
  - **Last.fm and Trakt remember who you are.** Both connectors now take your username alongside the key, so Discover and Poly no longer have to ask.
  - **Interests are researched overnight.** Discover works out three to five interests from what you have been doing, favouring what you do outside Polychat over chats about it, and researches each one before the morning, so every interest has fresh reading on day one.
  - **More kinds of card.** Episodes airing, releases and gigs appear under Coming up; videos and podcast episodes under Watching and listening; newsletters worth a minute under Reading with the sender named. Each opens a chat with the right first step, such as adding an event to your calendar.
  - **An evening edition.** Turn it on in Discover settings for a second, shorter edition at 19:00 that looks at tomorrow. It never makes an episode or a Perch.
  - **Poly knows your week.** Poly's own thread and its daily look around read what Discover gathered, so Poly can be specific about what you have been listening to, reading and watching without re-reading your services.
  - **File things in a notebook from anywhere.** Ask Poly to put a page, a note or some files in a notebook by name, and it will, creating the notebook only when you ask.
  - **Send Studio work on.** A finished report, deck or table in a notebook's Studio has a Send menu for Google Docs, Google Slides, Google Sheets and DEV when they are connected. Each send runs through the notebook chat and asks before it writes.
  - **Marquee records what you watch.** Tell Poly what you watched, are watching or want to see, with a rating and your thoughts, and it saves that to your Marquee shelf after you approve. Connectors without live discovery, such as Marquee, Last.fm and Trakt, now tell Poly their operations and fields instead of failing.
  - **A real feed.** Discover now reads the day's headlines for where you are, the front page of Hacker News, and, when Reddit is connected, the best posts from your communities. Every interest is researched from the news of the last three days, with the publisher and date kept. Poly's picks lead the edition, and up to three stories per interest, Reddit and Hacker News fill the Reading section beneath them, never repeating a link you have already seen. Your recent chats only shape the edition when nothing else is known about you yet.
  - **Discover documents explain themselves.** Each service's document in the Discover notebook now reads as a page: when it was read, what was found, and the raw result underneath. A service that could not be read says why. YouTube is read as your subscriptions and recent likes rather than your own uploads.
  - **Fixes.** The first edition after enabling Discover now gathers from your services before it is written, instead of being composed from recent chat titles alone. The Perch's captions follow the audio instead of jumping to the end, and loading a skill with a leading slash in its path no longer fails.

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

- 6980de8: Teammates now check what they are about to do before doing it, and skills are scanned before they go live.

  - **Intent check on real effects.** Before a routine, channel reply, delegation or handoff sends a message, spends money, deletes something, handles a credential or exports data, a second check compares the call, where it lands and who started the run against what you asked for. A call that does not follow from the request, or reaches a recipient or system you never named, waits for your approval with the reason attached.
  - **Connector and MCP calls say what they do.** A connector operation or an MCP tool is classed from the flags its vendor publishes: a read-only tool runs as a read, a tool that deletes or overwrites is treated as destructive and always asks, and anything unflagged stays a write. Dry runs draft the destructive ones instead of running them.
  - **Skill scanning.** Promoting a draft skill or importing one from another scope scans it first. Instructions that try to override the assistant, hide text, act without telling you, move credentials or private data out, embed a secret or point at a private address keep the draft but block it from going live, with each problem named.

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

- 80fee8e: MCP tools can now show their own interface in a conversation, and Polychat can be used as a tool from other assistants.

  - **Apps inside the chat.** When a connected MCP integration ships an interface for a tool (the MCP Apps extension), Polychat renders it in the reply in a sandboxed frame: pickers, tables, small dashboards. The app can refresh its own data through read-only tools; anything that would change something still goes through the conversation so it can ask you first.
  - **Polychat as an MCP server.** Point Claude, ChatGPT, Codex or any MCP client at the /mcp endpoint with a Polychat API key and it can run the same tools you can run in Polychat, and ask any of your teammates to take on a job. Anything that needs approval waits for you in Polychat.

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

- 91c7d3d: Choose how the assistant responds without writing a prompt.

  - **Style controls.** Personalised responses now has dropdowns for base style and tone (Professional, Friendly, Candid, Quirky, Efficient, Nerdy or Cynical), warmth, enthusiasm, emoji, and headers and lists. Leave any on Default to keep the assistant's usual behaviour.
  - **Custom instructions on top.** Your own traits and preferences sit below the controls and are added to the style you pick, so you can choose a tone and still add anything the controls do not cover. Instructions you have already written carry on working unchanged.

- 7b36da1: Sources is now where your media lives. Files' Given tab is renamed Sources and gains Podcasts, Image Studio and Replicate alongside the library.

  - Upload images, audio and video straight into Sources. Open any audio or video source to play it, transcribe it, write notes with decisions and action items, and make cover art. The transcript becomes searchable, so recordings work as grounding like any other source. This replaces the Recording Processor app.
  - Image Studio, sketch-to-painting and Replicate runs now save what they make into Sources, where it can be reused as material. They have moved out of Apps and the Canvas sidebar item into Files › Sources.
  - Make podcasts from your sources: pick sources, a format (deep dive, brief, debate or critique) and a length, and two hosts talk it through. Each episode lands in Sources with its audio, transcript, show notes and cover.
  - Group episodes into shows and create a private RSS feed link to subscribe in any podcast app. Making a new link turns off the old one.
  - Ask Poly or a teammate to make an episode with the new podcast tool, or install the Podcast Briefing recipe to get a fresh episode on your topics or Sources on a schedule.

- 80fee8e: Your teammates can now be reached by other agents over Agent2Agent. Each teammate has an agent card at `/a2a/teammates/<id>/.well-known/agent-card.json`, and any A2A client holding your Polychat API key can send it work, stream its progress, check on a task later or cancel it. The teammate works in its own conversation and still asks you in Polychat before anything that sends, spends or deletes.
- 7a9f872: Teammates and routines now show what they cost and can be given a monthly budget.

  - **Spend on the teammate page.** A teammate's card shows the credits its runs have used this month, and the working context has a Spend section with the same figure against its cap.
  - **Monthly caps.** Set a cap in credits on a teammate's working context or on a routine. Once the month's spend reaches it, new runs are refused with a note saying why, a routine over its cap pauses itself with the reason shown, and everything resumes when the month resets or you raise the cap.
  - **Runs remember their routine.** Each run records which routine started it, so routine spend is exact rather than estimated.

- 7accf45: Mistral speech now runs on Voxtral 3, with a hosted voice agent for Live.

  - **Transcription.** Mistral transcription uses Voxtral Mini Transcribe 3, and you can pick Voxtral Small Transcribe 3 in Settings for higher accuracy. It detects the spoken language rather than assuming English, and timed transcripts now label who said what.
  - **Custom vocabulary.** Add names, acronyms and jargon under Settings → Audio, one per line, and Mistral transcription, live transcription and the voice agent will listen out for them.
  - **Live transcription.** Mistral live transcription uses Voxtral Mini Transcribe Realtime 3. Notes labels each speaker as they talk, and Live conversations use Mistral's own end-of-turn detection, so a thoughtful pause no longer cuts you off.
  - **Mistral Voice Agent.** Pick Mistral Voice in Live for a hosted Voxtral 3 agent that listens, searches the web when it needs to and answers aloud. It uses your Mistral key or the platform one, and you can interrupt it mid-sentence.
  - **Speech.** Mistral speech uses Voxtral TTS 3 with its new preset voices in over 20 languages. The default is Mary (English, UK). Choose how expressive the delivery is under Settings → Audio.
  - **Your voices.** Save a voice from an MP3 or WAV recording under Settings → Audio and use it for speech. Only you can use your saved voices, and you need to confirm the voice is yours or you have permission. The API offers the same through `/audio/voices`, and `/audio/speech` accepts `expressiveness`.

- d7716ff: Polychat on Apple Watch and Apple TV, and notifications you can act on.

  - **Approve from the notification.** Task approvals arrive with Approve and Decline buttons, single questions take a typed or dictated answer, and Poly's updates take a reply, all without opening the app. They work on the Lock Screen and on Apple Watch, and approvals and questions break through Focus as time-sensitive.
  - **Poly on your wrist.** The Apple Watch app lists what needs you and what Poly is working on, approves or declines tasks and runs, answers single questions, and asks Poly anything by dictation, with the answer read aloud if you like. Sign in with one tap from a nearby iPhone, or with a code at polychat.app/device.
  - **Complications.** Put a count of what needs you, or Poly's status and next item, on any watch face. The Poly Live Activity also shows in the watch's Smart Stack.
  - **Wind down on the watch.** Play today's Discover wind down, or record a new breathing, body scan or unwind session, through AirPods with each step on screen and a tap on the wrist as it moves on. Time spent listening is saved to Apple Health as mindful minutes.
  - **Discover on Apple TV.** Today's edition, the episode with its pictures and captions full screen, wind down and every card, with the day's picks on the Top Shelf. Sign in by scanning a code with your phone. An Apple TV gets a Discover-only key, so your chats, projects and files stay out of reach, and you can revoke it from Profile.
  - **AirPlay episodes.** Episodes and wind downs show in Now Playing on the Lock Screen, Control Center and Apple Watch. Send them to an Apple TV with the AirPlay button and the current picture comes along, or mirror your screen for the full picture with captions.

### Patch Changes

- abf8eb7: Polychat keeps you signed in while you use it.

  - **Sessions renew as you go.** Signing in used to last seven days from the moment you signed in, however much you used Polychat in between. A session now extends itself each day you use it on the web or the desktop app, and only lapses after a week away.
  - **The desktop app no longer signs you out in the background.** Waking the Mac with no connection, or a brief network drop, used to leave the app looking signed out. It now waits for the connection and carries on, and only shows the sign-in screen when your session has actually ended. Signing in again reuses the session the app already holds before asking you to go through the browser.

- Updated dependencies [8b2929f]
- Updated dependencies [8b965f6]
- Updated dependencies [91c7d3d]
- Updated dependencies [7accf45]
- Updated dependencies [911642e]
- Updated dependencies [bf39c94]
- Updated dependencies [b3e3ea2]
- Updated dependencies [1fe4222]
- Updated dependencies [06c02dd]
- Updated dependencies [f4841cd]
- Updated dependencies [6980de8]
- Updated dependencies [abf8eb7]
- Updated dependencies [7b5038c]
- Updated dependencies [80fee8e]
- Updated dependencies [8b965f6]
- Updated dependencies [0a57f73]
- Updated dependencies [11381a9]
- Updated dependencies [91c7d3d]
- Updated dependencies [7b36da1]
- Updated dependencies [80fee8e]
- Updated dependencies [7a9f872]
- Updated dependencies [7accf45]
- Updated dependencies [d7716ff]
  - @ngriffin_uk/polychat-schemas@1.5.0
  - @ngriffin_uk/polychat-utility-core@0.5.0
  - @ngriffin_uk/polychat-ai-models@0.3.0
  - @ngriffin_uk/polychat-ai-providers@0.4.0
  - @ngriffin_uk/polychat-ai-functions@0.3.0
  - @ngriffin_uk/polychat-library-tools@0.4.0
  - @ngriffin_uk/polychat-library-policy@0.4.0
  - @ngriffin_uk/polychat-ai-billing@0.3.0
  - @ngriffin_uk/polychat-ai-integrations@0.4.0
  - @ngriffin_uk/polychat-library-chat@1.2.0
  - @ngriffin_uk/polychat-library-skills-catalogue@0.4.0
  - @ngriffin_uk/polychat-utility-server@0.3.0
  - @ngriffin_uk/polychat-ai-agents@0.4.0
  - @ngriffin_uk/polychat-ai-prompts@0.4.0
  - @ngriffin_uk/polychat-ai-experiments@0.2.2
  - @ngriffin_uk/polychat-ai-model-providers@0.3.1
  - @ngriffin_uk/polychat-ai-sandbox@0.2.3
  - @ngriffin_uk/polychat-ai-skills@0.2.2
  - @ngriffin_uk/polychat-ai-telemetry@0.2.2
  - @ngriffin_uk/polychat-library-benchmarks@0.2.1
  - @ngriffin_uk/polychat-library-flags@0.2.2
  - @ngriffin_uk/polychat-library-interactions@0.1.3
  - @ngriffin_uk/polychat-library-model-registry@0.3.1
  - @ngriffin_uk/polychat-library-sandbox@0.3.2
  - @ngriffin_uk/polychat-library-sites@0.3.1
  - @ngriffin_uk/polychat-ai-workflows@0.2.1
  - @ngriffin_uk/polychat-library-tasks@0.2.1

## 1.3.0

### Minor Changes

- 82c133e: Eval suites can run as a provider batch on OpenAI and Anthropic routes, at about half the price, with results within 24 hours. A new `batch` provider category wraps the OpenAI Batch API and Anthropic Message Batches.
- 005b9f3: Add Bedrock Managed Agents as a remote agent harness. Project chats run on the AgentCore Runtime and execution role from the workspace AWS connection, personal chats on the Runtime and role in user settings with the personal Bedrock key. It shares the OpenAI Agents session stream.
- 393652d: Image generation takes a `seed`, picks one when none is given, and reports it with the result, so the model can reuse it when the person asks to tweak an image and keep the composition.
- e7177c1: The research tool now takes a brief, a depth (quick, standard or deep), a format and a provider instead of fifteen transport options, defaults to Parallel's pro processor rather than ultra, and ships with a web-research skill that sharpens vague briefs with up to three questions before a paid run.
- 7e757d4: Attached documents that would take more than three quarters of the model's context window are replaced with a digest instead of failing the message. Each 50,000-character part is summarised in parallel with the auxiliary model, an overview is built from those summaries, failed parts are named rather than dropped, and complete digests are cached per user by content hash.
- e820856: MCP tool results keep their PNG, JPEG and WebP images for models that read images, and tool-result images reach every provider as real image input instead of serialised base64 text. MCP server settings offer Inspo as a one-click server for design references.
- 7bec25b: Add Polychat Benchmarks: GeoGuess, Countdown, Fermi Bets, Long Odds, Hamster Wheel and Strudel Groove, run on one engine for official, personal and workspace scopes. Results at `/benchmarks` show intervals, Artificial Analysis indexes with attribution, measured cost and a medal table, people can play the auto-scored benchmarks and vote on blind pairs, the Benchmarks app runs them against your own models and keys, and the model selector previews each model's standings.
- 65fbf81: Add the newest live models. Gemini 3.5 Transcribe Live runs transcription sessions (so Notes dictation can use Gemini) and Gemini 3.5 Live Translate runs translation sessions, both through the existing Live API token flow. GPT-Live 1 joins the OpenAI realtime models as a server-brokered WebRTC call with Responses delegation, so the browser never holds a project key.
- 65fbf81: Refresh the realtime providers and Note Taker. Notes dictation now runs on the shared live session with any ready transcription provider and commits OpenAI turns on silence. Gemini Live defaults to Gemini 3.8 Live, OpenAI transcription sends the `languages` field and drops the retired Whisper and GPT-4o models, translation sessions use the dedicated translations endpoints, and proxied transcription sessions settle billing on their measured audio instead of a flat reservation. The proxy audio cap now covers the full session length, Notes lists return excerpts with server-side search, metadata is only described once a note has enough text, and the unused video analysis options are gone.
- b97c227: Recording summaries now come from the auxiliary model as structured notes: a summary, the decisions and the action items with owner and due date when the recording states them. In a project, each action item can be added to the task board.
- c965c69: Sites can borrow colours and fonts from a public reference page. The computer sandbox reads the page's computed background, text, accent colours and font families, and the theme gains an optional custom palette and Google Fonts families that render over the named presets.

### Patch Changes

- 06e4619: Add two deterministic graders for summaries: `fact_coverage` scores the share of required facts (one per line in the case's expected value) an answer keeps, and `grounded_numbers` scores the share of the answer's numbers that appear in the case input.
- e41549c: Keep transcription timings. Providers return segments and words, `/audio/transcribe?timestamps=true` includes them, notes from media quote real `[m:ss]` markers instead of guessing, and recordings play captions and download them as SRT or VTT.
- Updated dependencies [82c133e]
- Updated dependencies [005b9f3]
- Updated dependencies [393652d]
- Updated dependencies [e7177c1]
- Updated dependencies [7e757d4]
- Updated dependencies [e820856]
- Updated dependencies [7bec25b]
- Updated dependencies [65fbf81]
- Updated dependencies [65fbf81]
- Updated dependencies [b97c227]
- Updated dependencies [c965c69]
- Updated dependencies [06e4619]
- Updated dependencies [e41549c]
  - @ngriffin_uk/polychat-utility-core@0.4.0
  - @ngriffin_uk/polychat-ai-providers@0.3.0
  - @ngriffin_uk/polychat-schemas@1.4.0
  - @ngriffin_uk/polychat-ai-model-providers@0.3.0
  - @ngriffin_uk/polychat-library-skills-catalogue@0.3.0
  - @ngriffin_uk/polychat-ai-agents@0.3.0
  - @ngriffin_uk/polychat-ai-integrations@0.3.0
  - @ngriffin_uk/polychat-library-policy@0.3.0
  - @ngriffin_uk/polychat-library-benchmarks@0.2.0
  - @ngriffin_uk/polychat-ai-prompts@0.3.0
  - @ngriffin_uk/polychat-library-sites@0.3.0
  - @ngriffin_uk/polychat-library-model-registry@0.3.0
  - @ngriffin_uk/polychat-ai-billing@0.2.1
  - @ngriffin_uk/polychat-ai-experiments@0.2.1
  - @ngriffin_uk/polychat-ai-functions@0.2.1
  - @ngriffin_uk/polychat-ai-sandbox@0.2.2
  - @ngriffin_uk/polychat-ai-skills@0.2.1
  - @ngriffin_uk/polychat-ai-telemetry@0.2.1
  - @ngriffin_uk/polychat-library-chat@1.1.1
  - @ngriffin_uk/polychat-library-flags@0.2.1
  - @ngriffin_uk/polychat-library-interactions@0.1.2
  - @ngriffin_uk/polychat-library-sandbox@0.3.1
  - @ngriffin_uk/polychat-library-tools@0.3.1
  - @ngriffin_uk/polychat-utility-server@0.2.1
  - @ngriffin_uk/polychat-ai-models@0.2.1

## 1.2.0

### Minor Changes

- 6967a07: Host agent harnesses on Polychat's own ports. The agent worker now runs the Pi and OpenCode harnesses and a Hermes container behind one RPC contract, with models served by the API's OpenAI-compatible `/agents/model` port, workspace tools gated by the permission mode, and every reply streamed into chat as it is generated. OpenAI Agents joins as a remote harness through the same `agent-harness` chat provider. The sandbox worker moves to Sandbox SDK 1.0 with app-owned `Workspace` and `Computer` classes, absorbs the computer worker, and keeps caches and browser profiles with `DirectoryBackup`.

### Patch Changes

- Updated dependencies [6967a07]
  - @ngriffin_uk/polychat-schemas@1.3.0
  - @ngriffin_uk/polychat-library-sandbox@0.3.0
  - @ngriffin_uk/polychat-utility-core@0.3.1
  - @ngriffin_uk/polychat-ai-providers@0.2.1
  - @ngriffin_uk/polychat-ai-sandbox@0.2.1

## 1.1.0

### Minor Changes

- 6db7a00: Add the experimentation primitives. `library-flags` is an OpenFeature-shaped evaluation contract with a rules provider (deterministic bucketing from the targeting key, weighted splits, targeting, enable gates), a Cloudflare Flagship binding adapter and a layered provider that lets the dashboard override code. `ai-experiments` defines flags and experiments in code, assigns users with `feature_flag.evaluation` exposure events, runs work under an assignment, tracks outcomes with assignments attached, and runs offline variant sweeps with metrics. The API wires a per-request `Experiments` into the service context, tags AI generation telemetry with `experiment.<key>` properties, gates the flagged cron tasks through flags whose defaults come from the existing environment toggles, accepts an optional `FLAGS` Flagship binding, and serves `GET /flags/bootstrap`. Cron `enabledWhen` may now be asynchronous.
- 4968623: Add the sandbox primitives. `library-sandbox` collects the mechanisms the API, sandbox Worker and computer Worker each carried: the dynamic Worker evaluation template and content-addressed code ids, outbound policy with a virtual tools origin, lease fences, HMAC-signed grants, execution control with pause and cancel, output redaction and request helpers. `ai-sandbox` composes them over Cloudflare's Worker Loader into `createEvaluator`, the loopback `OutboundGateway` entrypoint and `createCodeMode`. The API gains the `run_code` tool (backed by the `LOADER` binding) that runs model-written JavaScript in a fresh isolate and routes `tools.<name>(args)` calls back through the function registry. The computer Worker now fences leases and signs screen grants through the library and reports stale leases by code; the sandbox Worker uses the shared execution control, cancellation and redaction, and verifies JWTs with `@ngriffin_uk/auth-jwt` instead of a hand-rolled HS256 check.
- dd4389b: Let the model edit a large artifact without rewriting it. An artifact tagged `mode="edit"` carries FIND/REPLACE blocks, and the API applies them to the latest version of that artifact when the turn finishes, storing and sending the full updated artifact. Each FIND must match exactly once. While a reply streams the thread shows that the artifact is updating, and an edit that cannot be applied is reported rather than rendered.
- 3c23660: When a teammate started from a Slack, Telegram or email thread hands work to a delegate, the follow-up it writes once that work reports back is now sent to the same thread. The sender mapping and binding are rechecked before sending, and each follow-up is delivered at most once.
- 462cbe7: Let the model search earlier conversations. `search_conversations` returns one excerpt per matching conversation with its title and date, scoped to the user's personal chats or, inside a project, to that project after an access check. It is on by default for signed-in chats. The unused, unescaped `MessageRepository.searchMessages` is replaced by the scoped query, and `excerptAround` joins the shared string helpers.
- d25fd94: Let people reach Polychat by email. A personal email binding is keyed by the address you write from, linked with the usual one-time command, and answered by threaded plain-text replies. Inbound mail arrives through the Worker email handler and is only accepted when a DKIM signature aligned with its From domain also covers the To or Cc header naming Polychat's inbox, so forged senders and replayed messages are refused. Auto-replies are ignored to avoid loops.
- 5ead2cc: Import GitHub and Linear issues into Work and review exact GitHub PR revisions manually or through signed automatic intake. Retain captured Sources and review Outputs, isolate each workspace and credential owner, and approve publication separately.

  Apply migration `0061_project_task_integrations` before deployment. Configure the GitHub webhook secret and pull-request events for automatic intake, and pull-request write permission for publication.

- dd4389b: Let React artifacts show live data and charts. An artifact can declare read-only connector reads in a leading `<bindings>` block and read them with `usePolychatData` from `@polychat/data`. The host runs each read through the API, which takes the declaration from the stored message, refuses operations that change anything, only lets a refetch change declared arguments, caches results for a minute and rate-limits each artifact. React artifacts now compile with Sucrase instead of Babel standalone, can import `recharts`, and are assembled without string replacement, so `$` sequences and `</script>` in component source no longer corrupt the page.
- c126d04: Add model governance to Work. Workspaces can search Hugging Face, import models and datasets pinned to a commit, and review static inspection evidence that never loads the weights. Approvals follow versioned policies with dry runs, exceptions and expiry. Suites can be compared across serving routes with confidence intervals, and fine-tunes run on Hugging Face Jobs from governed conversation snapshots with lineage and a compute record. Approved versions can be served on dedicated Inference Endpoints, drift is caught by nightly replays, and any route or version exports as a CycloneDX ML-BOM. Workspaces can enforce approved routes in project chats, and generations carry route and version tags. Each workspace connects its own Hugging Face account or organisation under Govern, with the platform token as an optional default, and retiring a deployed route deletes its endpoint. Training moves from Profile to Models › Build, and Hub staging for Bedrock imports is keyed by commit.
- 90f7110: Turn Work › Models into a model platform on the workspace's own provider accounts. Connect Hugging Face, AWS, Together, Fireworks, Nebius, Google Vertex, Azure AI Foundry, RunPod, Cloudflare Workers AI or any OpenAI-compatible endpoint, then upload weights or register them from a bucket, build governed datasets from files, the Hub, buckets, rated conversations or a teacher model, and train with supervised, preference, reinforcement, distillation, embedding, merge or quantise runs after comparing trainers on fit and cost. Deployments are sized and priced per host, serve through aliases with eval gates, canaries and rollback, and appear in chat as models. Governance adds per-action permissions with separation of duties, budgets with spend approval, idle pause, revocation across lineage, erasure requests, an audit trail and CycloneDX, SPDX, model card and training content exports.

  The personal Training app, the training Worker and `component-experiences/training` are removed, and the API now mounts the platform under `/model-platform`.

- 251ac59: Use remote MCP servers with any model. When MCP is enabled and the model has no hosted MCP tool, or a server's credential belongs to Polychat, the turn gets `mcp_list_tools` and `mcp_call_tool`, which call the server directly through a new Streamable HTTP client. Calls are classed as writes, so they follow the same approvals as other external writes, and only the tools a connection allows can run. MCP connections can now sign in with OAuth (discovery, dynamic client registration, PKCE and refresh) with tokens stored encrypted, and token connections can be kept for Polychat instead of OpenAI.
- 41bb6a8: Short skills can now apply themselves to the messages they help with. A skill marked `activation: per-message` (or saved with "apply automatically") is considered before each turn and, when it clearly fits, its instructions are added to that turn only, without a `load_skill` call. Selection has a 1.5 second deadline and never blocks the reply.
- 67b52ed: Give Poly an agenda. `GET /poly/agenda` derives what needs the person, what Poly is working on and what it finished this week from the Poly thread's delegations, goal and latest run, with no new storage. Poly's prompt carries the agenda each turn, the overlay shows it above the thread, and the sidebar's Ask Poly button shows Poly's status. The agenda refreshes on the live delegation, goal and run events for the Poly thread.
- 67b52ed: Let people reach Poly from their own chats. A personal Telegram or Slack binding pointed at Poly continues the Poly thread itself, with Poly's own tools and without navigation, and when a routine result interrupts, Poly also sends it to those bound chats through the idempotent outbound delivery record. Slack proactive messages post at the top of the conversation rather than into a thread.
- 67b52ed: Budget Poly's interruptions. Routines Poly sets up from its thread now report back to it, and each routine result passes through a judged, budgeted handoff before it reaches the person: results waiting on them always interrupt, failures and results a decision policy rates as urgent interrupt within five a day and thirty minutes apart, and everything else is noted quietly. Each occurrence is decided once and recorded as a `poly.handoffs` activity on the Poly thread, and the agenda, Poly's prompt and the overlay list what was noted and why.
- ee31a6d: Make Poly a platform teammate with one continuous thread per person. `POLY_TEAMMATE` is synced like the other platform teammates but kept out of rosters, `GET /poly/home` opens the person's Poly context and its `poly` home conversation, and the overlay always opens that thread through the Poly teammate. Poly runs only in its owner's thread, a Poly thread only runs as Poly, and navigation tools are offered only on turns the person started.
- 67b52ed: Let people approve a Poly write once and for all, for one destination. When Poly at the assistant level waits on a write with a known destination, the approval card offers "Always allow here". The server derives the tool and destination from the stored pending call and keeps the approval on the Poly context for thirty days, where a Cedar condition lets matching writes run unattended. Sends, spending, deletes, credentials and exports still ask every time. Approvals are listed in Poly's autonomy menu and can be revoked there.
- ee31a6d: Let Poly do things in its thread. Poly's grants now cover delegation, goals, memory, research, documents, notes, skills and automations alongside navigation, its thread uses the standard chat prompt with its persona and memory, and `buildStandardChatPrompt` takes a `poly` option that adds Poly's behaviour and the person's current place. `buildPolyPrompt` is removed.
- 6966643: Grant selected actions from existing connectors directly to projects through Plugins, without creating a recipe. Reuse personal accounts, the connector catalogue, project capabilities and existing execution approvals. Preserve exclusions and narrower recipe permissions.
- 462cbe7: Queue follow-ups while a Chat reply is running. The composer stays open during a reply and queues what you type, up to ten messages per conversation, listed above the composer and removable. Queued messages are held as suspended `queued_chat_message` tasks and the next one is released when the run ends, so they send in order even after the tab closes. Work keeps steering the run instead.
- e4ba666: Start a recipe from any service with a private webhook URL. Each webhook can carry an "only run when" condition, can be paused, rotated or deleted, and honours an Idempotency-Key header so retries do not run twice. Payloads reach the recipe as untrusted data and never carry authority. Composio and webhook events now share one admission path.
- 6e76041: Resume delegations whose run was interrupted instead of failing them. Tool calls left without a result are settled first: reads may run again, anything else is reported as of unknown outcome so it is never repeated automatically. A delegation resumes at most twice, before its deadline, within the steps and credit it has left.
- 77a5ee5: Shared conversation links now stop at the moment you shared them. Messages sent afterwards stay private until you choose Update link, and stopping sharing retires the link so sharing again issues a new one. Public reads are sent with no-store, no-referrer and noindex headers.
- 57f8a16: Add Sites, a generative site builder that works from one brief. Jev classifies the brief into a plan (kind, scope, tone, palette, model tier), a tier-selected coding model streams the site as JSON Patch lines against a guardrailed component catalogue, and the shell renders every patch the moment it lands. `library-sites` holds the catalogue, patch stream compiler, validator and repair, prompt assembly, theme tokens and a deterministic Next.js and Tailwind code generator; `component-sites` holds the live React registry, themed preview and code view. Sites persist as revisioned outputs, refine in follow-ups, export as runnable project files, and hand off to a project's sandbox for a full build. The SSE buffer parser now lives once in `utility-core`. Sites are interactive (state, bindings, visibility, repeat, filters and actions in both the live renderer and the generated code), editable in place through an element inspector with zero-token edits and scoped refinement, exportable straight to a pull request with generated images, embeddable in chat through the `build_site` tool, revisioned with restore and public preview links, and judged by Jev at planning, refinement, quality-scoring and prompt-evaluation time.
- 07290f2: Add a teammate autonomy dial. A teammate context can be an observer, an assistant or a partner, enforced by Cedar over each call's effect class: observers only read and draft, assistants ask before writes, partners write within their grants, and sends, spending, deletes, credentials and exports always ask. Poly starts as an assistant and its overlay can change the level. Run triggers now reach tool availability and execution, so Poly's navigation gate holds there too.
- c026725: Add the Waiting on You recipe. It checks connected GitHub, Linear, Slack and Gmail accounts for reviews, assigned work, mentions, threads and emails that are waiting for your reply, ranks them by who is blocked, and suggests one next step for each without changing anything. Run on a schedule by the Poly, urgent items reach you through its usual handoff budget.

### Patch Changes

- ece96c4: Add the billing and telemetry primitives. `ai-billing` holds turn estimates, credit state, rate-card pricing, provider billable units, subscription entitlement, price drift detection, and the usage engine (ledger, credit admission, reservations, plan allowances, infrastructure and capability metering) behind a `UsageStore` contract the API implements over its repositories. `ai-telemetry` holds the logger, a `Telemetry` facade over Analytics Engine, PostHog, beacon and OTLP sinks, AI generation and training-example capture, and token usage helpers. The API takes its logger, metrics recorder and training-example capture from this package, and its `lib/` tree now holds only host infrastructure with every capability under `services/`.
- ece96c4: Move the model catalogue and model policy out of the API. `library-model-catalogue` owns the models.dev data, its schema and the sync script, and `ai-models` owns lookups, tier and lineup resolution, credential authority, reasoning and verbosity rules. The API loads models from these packages and the `sync-models-dev` workflow runs from the catalogue package.
- ece96c4: Add the AI function, agent, tool, workflow and task primitives. `ai-functions` exposes task-shaped calls (`generateText`, `generateObject`, `classify`, `extract`, media and retrieval) over a provider runtime. `ai-agents` builds `Agent` on the decision loop and tool catalogues, and replaces `agent-core` in every host. `library-tools` replaces `library-tool-runtime` and the tool registry schema with definitions, catalogues, validation and execution. `library-tasks` adds outcome settlement, execution leases, handler registries, polling and cron schedules and status machines, and `ai-workflows` wraps them in `on`/`poll`/`every` so the API declares queued tasks, self-rescheduling pollers (now with an attempt cap) and cron jobs in one registry.
- 33133cc: Centralise every authored prompt in a catalogue and a retrieval package. `library-prompts-catalogue` holds all prompt text and fragments as data with a validating schema, variables and conditionals; `ai-prompts` retrieves entries by id, task or variant, renders `{{variable}}` templates, and composes the chat, meta-assistant, sandbox, memory, document, agent, sandbox-worker, provider and panel prompts. Hardcoded prompts are removed from `ai-providers` (image styles and guardrail policies), `ai-functions` (task system prompts), `ai-agents`, `schemas` (council member prompts, teammate and platform teammate briefs) and the API and sandbox worker services, which now source their text from the catalogue.
- ece96c4: Add the provider primitives package and move every provider implementation into it. `ProviderLibrary` owns categorised bootstrapping, alias and lifecycle resolution, per-category decorators, and host error mapping, and providers receive a `ProviderRuntime` (`ProviderHost` plus a resolver for sibling providers) instead of importing host modules. Platform credential detection, user-versus-platform API key resolution, and provider fallback move there from the API. `utility-server` holds the server helpers those providers share, and the API and sandbox Workers resolve providers through the library.
- 33133cc: Move the built-in Agent Skills into a catalogue package. `library-skills-catalogue` owns the SKILL.md documents and resources, the frontmatter schema, document parsing and the `SkillCatalog` resolver; `ai-skills` adds retrieval, resource reads and the `<skill_content>` / `<skill_resource>` formatting. The API keeps authored-skill persistence, availability and scope, and reads built-in skills and formatting from the packages.
- b4c0c65: Add user feedback capture to telemetry. `captureAiFeedback` fans thumbs feedback out to a new AI Gateway sink that patches the stored log (when the message has a log id) and to PostHog as a survey response linked to the chat run trace that produced the message. Provider generation events now use the chat run as `$ai_trace_id` (falling back to the conversation) so feedback and generations link in AI Observability. The chat feedback endpoint accepts a `message_id`, resolves the message, run id, log id and trace id on the backend, and attributes feedback to the latest assistant message when clients send only the conversation. The frontend sends the message id and always shows feedback prompts on assistant messages.
- 462cbe7: Settle dead chat runs without waiting for someone to open them. A scheduled sweep reconciles running or cancelling runs whose thread lease has lapsed, and streamed text is checkpointed on the run so an interrupted turn keeps its partial reply as a stopped message instead of losing it.
- 8c4ed1e: Move Composio and the connector provider abstraction out of the API. `library-composio` owns the configured toolkit catalogue, its schema, the session handle contract and the `composio:sync` script, and `ai-integrations` owns the connector provider registry, operation and approval policy, write-outcome classification, API-key executors, the Composio REST and trigger clients, and the Pashi contract, catalogue and client. The API keeps connection authority, approvals, the private file bridge, run lifecycle, persistence and the function tool surfaces, and consumes both packages through `ai-integrations`.
- b105d00: Paginate flagged dataset rows correctly and preserve remaining warnings when excluding rows. Recalculate revision statistics, reject invalid indexes, reuse repeated exclusions, and recover partial saves without duplicating files.

  Preserve selections after failed actions, open the resulting revision after success, and show dataset loading errors. Fail missing upload previews promptly and cancel source streams when previews stop early.

  Associate switch labels and descriptions automatically when no explicit control ID is supplied.

- 462cbe7: Stop saving blank assistant replies. When a model finishes a step with no visible text and no tool calls, the agent loop retries the request once, then asks for a tool-free answer from what the conversation already holds, and finally writes a plain notice if both come back empty. Every attempt's usage is billed with the turn, and empty replies are logged as `empty_model_response`.
- 0c9087c: Count unread task notifications across the whole inbox. `unread` used to be counted from the returned page only, which is at most 50 rows by default, so it stopped at the page size. `TaskNotificationRepository.countUnreadInbox` now counts over the same filter `listInbox` uses, so "N unread" labels and the Attention badges show the real total.
- b105d00: Require budget checks and approval for deployment resumes and scale increases. Wait for provider provisioning and deletion to finish before marking dedicated deployments deleted, and expose unsupported pause controls in host capabilities.

  Claim the paid continuation after a Together upload so concurrent polls cannot create duplicate endpoints. Preserve uncertain continuation outcomes for reconciliation.

  Preserve input withdrawals on completed training outputs and check current route approval for Chat and custom evaluation judges. Pass validation data to embedding training and run GGUF conversion with checked argument lists.

- b105d00: Verify every published upload file before inspection, including files without Hub hashes, and mark failed publications accurately. Respect pause and delete requests before provisioning, schedule resumed deployments, and calculate idle time from usage and resume events instead of background polling. Validate dataset byte ranges and restrict credentials during redirected downloads.

  Keep route revocations in force until explicit re-approval, record withdrawals for automatically allowed models, and retire affected routes during erasure without revoking the clean dataset revision.

- b105d00: Expose approved workspace aliases in Chat, resolve each alias once per request, and enforce workspace membership, current approval and deployment availability. Apply promotion checks to initial targets and rollbacks, and create deployment aliases without a target until explicitly promoted.

  Claim spend approvals before execution to prevent duplicate starts. Add executing and failed request states, enforce separate approval when configured, and recheck budgets before starting approved work.

  Preserve multipart upload progress under concurrent requests and order alias approval events reliably when timestamps tie. Keep internal evaluation and synthetic dataset calls scoped to their workspace deployment.

- b105d00: Claim provider creation atomically to prevent duplicate training jobs and deployments. Preserve cancellation requests during submission, expose the cancelling state, and register jobs that finish immediately. Recheck model approval before creation and require reconciliation for interrupted provider requests.

  Settle hosting intervals and replace training costs atomically, and preserve accrued costs when pausing, scaling or deleting a deployment. Apply migration 0055 before deploying the API.

- ee31a6d: Call the Poly by its name everywhere. The `meta` conversation type is now `poly`, the `meta_assistant` request field is now `poly`, and the meta assistant contracts, prompts, tools, hooks and overlay are renamed to match (`POLY_NAVIGATION_TOOL_NAMES`, `polyRequestSchema`, `buildPolyPrompt`, `PolyOverlay`, `usePolyNavigation`). A data migration moves stored `meta` conversations to `poly`. Behaviour is unchanged.
- 169e2f5: Add the Polychat CLI, which pairs a terminal, server or gateway through a device code instead of a pasted API key, and show it on the downloads page. The device approval page now shows the code as cells, the requesting client, its expiry and what approval grants. Device sign-in clients no longer trip bot detection when they start and poll.
- 1e5cafb: Let `ask_user` ask for a file. A question can set `requestsFile`, the question card offers an "Attach a file" button for it, and the chosen files are uploaded with the same model rules as composer attachments and sent with the answers.
- cb9ddcc: Declare what each tool changes. `TOOL_EFFECT_CLASSES` names eight effect classes, `ToolDefinition.effects` declares a tool's class and destination, and `resolveToolEffectClass` treats an undeclared tool as a write. The API's built-in catalogue now refuses a tool without effects, and `call_api` and `use_recipe_connector` classify each call from its input.
- Updated dependencies [ece96c4]
- Updated dependencies [6db7a00]
- Updated dependencies [ece96c4]
- Updated dependencies [ece96c4]
- Updated dependencies [33133cc]
- Updated dependencies [ece96c4]
- Updated dependencies [4968623]
- Updated dependencies [33133cc]
- Updated dependencies [b4c0c65]
- Updated dependencies [dd4389b]
- Updated dependencies [d3f1df3]
- Updated dependencies [297b848]
- Updated dependencies [3c23660]
- Updated dependencies [8c4ed1e]
- Updated dependencies [462cbe7]
- Updated dependencies [b105d00]
- Updated dependencies [d25fd94]
- Updated dependencies [5ead2cc]
- Updated dependencies [dd4389b]
- Updated dependencies [462cbe7]
- Updated dependencies [b105d00]
- Updated dependencies [c126d04]
- Updated dependencies [b105d00]
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
- Updated dependencies [6966643]
- Updated dependencies [1e5cafb]
- Updated dependencies [462cbe7]
- Updated dependencies [e4ba666]
- Updated dependencies [1df361b]
- Updated dependencies [6e76041]
- Updated dependencies [b105d00]
- Updated dependencies [d3f1df3]
- Updated dependencies [57f8a16]
- Updated dependencies [07290f2]
- Updated dependencies [cb9ddcc]
  - @ngriffin_uk/polychat-ai-billing@0.2.0
  - @ngriffin_uk/polychat-ai-telemetry@0.2.0
  - @ngriffin_uk/polychat-ai-experiments@0.2.0
  - @ngriffin_uk/polychat-library-flags@0.2.0
  - @ngriffin_uk/polychat-ai-providers@0.2.0
  - @ngriffin_uk/polychat-ai-workflows@0.2.0
  - @ngriffin_uk/polychat-schemas@1.2.0
  - @ngriffin_uk/polychat-ai-models@0.2.0
  - @ngriffin_uk/polychat-ai-functions@0.2.0
  - @ngriffin_uk/polychat-ai-agents@0.2.0
  - @ngriffin_uk/polychat-library-tools@0.3.0
  - @ngriffin_uk/polychat-library-tasks@0.2.0
  - @ngriffin_uk/polychat-ai-prompts@0.2.0
  - @ngriffin_uk/polychat-utility-server@0.2.0
  - @ngriffin_uk/polychat-library-registry@0.3.0
  - @ngriffin_uk/polychat-ai-sandbox@0.2.0
  - @ngriffin_uk/polychat-library-sandbox@0.2.0
  - @ngriffin_uk/polychat-utility-core@0.3.0
  - @ngriffin_uk/polychat-library-skills-catalogue@0.2.0
  - @ngriffin_uk/polychat-ai-skills@0.2.0
  - @ngriffin_uk/polychat-library-chat@1.1.0
  - @ngriffin_uk/polychat-ai-integrations@0.2.0
  - @ngriffin_uk/polychat-ai-model-providers@0.2.0
  - @ngriffin_uk/polychat-library-model-registry@0.2.0
  - @ngriffin_uk/polychat-library-policy@0.2.0
  - @ngriffin_uk/polychat-library-sites@0.2.0
  - @ngriffin_uk/polychat-library-goals@0.1.1
  - @ngriffin_uk/polychat-library-interactions@0.1.1

## 1.0.0

### Major Changes

- f440eb7: Collapse the seven sandbox tools into one `run_sandbox_task` with a `taskType` argument, and add a `sandbox-tasks` skill covering how to pick the type and write a task an unattended run can complete. `run_feature_implementation`, `run_code_review`, `run_test_suite`, `run_bug_fix`, `run_refactoring`, `run_documentation` and `run_migration` are removed.
- f440eb7: Retrieval becomes a tool the model calls. `search_documents` searches the user's own material and returns passages; the `use_rag` request flag, the composer toggle and the RAG settings panel are removed, along with the prompt augmentation that fired on every message whether or not the turn needed it.

  Memory recall splits cleanly: the synthesis stays in the prompt because it is short and always relevant, and per-turn similarity search gives way to `search_memories`, which the model calls when it needs a specific memory.

  Conversation titles are generated as post-turn server work and arrive on the stream, so a first turn no longer costs an extra client round trip. The client still titles conversations the server does not store.

### Minor Changes

- f440eb7: Saved agents now run on the platform prompt. An agent's instructions and few-shot examples become a persona layered into the generated system prompt, so an agent conversation gets safety standards, the skills roster, memory, formatting, channel context and model metadata instead of the agent's own text alone.

  The coding prompt collapses into the standard assembler, which fixes a coding model in agent mode receiving no agent guidelines and a coding model on SMS receiving no channel context.

- 42c36ea: Release the applications from changesets. Merging a changeset that names an application versions it, tags it and publishes a GitHub release with its changelog entry; the desktop release also carries macOS, Windows and Linux archives built on their own runners. The API serves those archives from `/desktop/downloads` and answers the desktop updater from `/desktop/releases`, so neither the website nor the application needs to know where the builds are hosted.
- f440eb7: Run every chat turn through one engine. Streaming and buffered requests now differ only in the transport they hand to the agent loop, so the step budget, tool execution, persistence, usage limits and the goal contract are resolved in one place instead of three.

  Streaming agent turns are now gated by the active goal, which the streaming path previously skipped. Ordinary chat gets the chat mode step budget rather than a single tool round. Memory is classified once per run rather than once per turn, and no longer suppresses goal continuation.

- f440eb7: Second opinions run as a panel. A `second-opinion` skill holds the method and a `second_opinion` tool runs it over `runPanel`, with each reviewer answering on its own model and reading what earlier reviewers said.

  The client no longer builds the review prompt, detects the intent with a regex, or carries the request through message data. The message action sends a plain request and the model chooses the reviewers. `buildOpinionRequestPrompt`, `canRequestOpinionForMessage`, `getOpinionSourceContext`, `OpinionModelPicker` and the `renderOpinionSelector` prop are removed; `CouncilTurnView` becomes `PanelTurnView`, which both panels render through.

### Patch Changes

- f440eb7: `lib/prompts` is the chat system prompt and nothing else. The article, web-search, extract-content and drawing prompts move to the services whose routes they back.

  The prompt no longer compacts itself on small-context models. ADR 0032 found that compact variants drop exactly the detail that prevents a broken result, and the same mechanism was still trimming the principles and metadata sections.

- Updated dependencies [40048e2]
- Updated dependencies [588f262]
- Updated dependencies [ac5b12e]
- Updated dependencies [42c36ea]
- Updated dependencies [e2ffadb]
- Updated dependencies [34728e1]
- Updated dependencies [d841b16]
- Updated dependencies [d841b16]
- Updated dependencies [293b1ca]
- Updated dependencies [f440eb7]
- Updated dependencies [6334297]
- Updated dependencies [fc4ed91]
- Updated dependencies [0a2d695]
- Updated dependencies [2c14529]
- Updated dependencies [1836aad]
- Updated dependencies [19573b8]
  - @ngriffin_uk/polychat-schemas@1.0.0
  - @ngriffin_uk/polychat-utility-core@0.2.0
  - @ngriffin_uk/polychat-library-agent-core@0.2.0
  - @ngriffin_uk/polychat-library-tool-runtime@0.2.0
  - @ngriffin_uk/polychat-library-registry@0.2.0
