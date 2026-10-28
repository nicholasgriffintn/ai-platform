# @ngriffin_uk/polychat-library-skills-catalogue

## 0.4.5

### Patch Changes

- 0af6a2b: Discover researches the day's topics before it talks about them, and Reading keeps every useful link.

  - **Research first.** Before The Perch and today's episode are written, Poly reads the full articles behind each topic the edition covers, searches wider around the lead stories and writes a briefing: what happened, how it got here, why it matters, the different views and what comes next.
  - **Deeper conversations.** The Perch is now a ten minute conversation that goes deep on the two or three topics with the most to say, instead of a quick run through headlines. Neither The Perch nor the episode comments on scores, points or what an article does or doesn't say.
  - **Researching, then recording.** Asking for The Perch queues the research first, and the player shows Researching until the recording starts.
  - **Every useful link.** Reading no longer stops at six links or two per topic. After Poly's own picks it keeps every fresh link found for the day, with the topics the edition covers first, then the day's headlines and your services' feeds, and the same story only once.
  - **Research adds to Reading.** Pages Poly reads while researching a topic join Reading next to that topic's other links, unless an earlier edition already showed them.

- Updated dependencies [0af6a2b]
- Updated dependencies [afe0236]
- Updated dependencies [c79e769]
- Updated dependencies [810eff4]
- Updated dependencies [00f22ad]
  - @ngriffin_uk/polychat-schemas@1.10.0
  - @ngriffin_uk/polychat-utility-core@0.9.0

## 0.4.4

### Patch Changes

- Updated dependencies [5d70d5d]
- Updated dependencies [8f480ac]
  - @ngriffin_uk/polychat-schemas@1.9.0
  - @ngriffin_uk/polychat-utility-core@0.8.0

## 0.4.3

### Patch Changes

- ce66ee9: Discover keeps your conversations with its cards, and background work leans on better everyday models.

  - **Card conversations stay with the card.** Asking about a Discover card and coming back later now opens that conversation again, not an empty Take it further.
  - **Write again lives in Settings.** The page header is just Settings now. Write again sits under Today's edition in the Discover settings.
  - **Reading, titling and compaction prefer Workers AI.** GPT-6 Luna leads for accounts that can use OpenAI, Workers AI comes next, and Google models are now the last resort.

- ed38a63: Listen to what you read.

  - **Listen.** Discover reads and text, web page and document files have a Listen button that reads them aloud in your narrator voice. It starts playing as soon as the first passage is ready and carries on while the rest are recorded. Once read, it plays again without recording anew unless the text changes.
  - **Share.** On iPhone, a read in Discover has a Share button for sending it to another app.

- ed38a63: Wind down is no longer the same session every night.

  - **Tonight's pick.** Opening Wind down suggests one session from your day, last night's sleep and what you played recently, ready to start in one tap. It never suggests the same kind or sound two nights running.
  - **About your day.** Unwind names a few real things from today and sets them down. Turn off Mention my day when others can hear. Apple TV always leaves your day out.
  - **New kinds.** A slow story where nothing much happens, carried on over up to five nights; your Readwise highlights read back slowly; Park tomorrow, where what's on your mind comes back as things worth doing in the next edition; and Just the sound, with no voice at all. Sessions can now run to 30 minutes.
  - **Tonight's story in Worth a look.** Evening editions can offer a story on a topic you follow. It's only recorded when you tap it.
  - **Sound and voice.** One slider moves between the sound and the voice, and Sound after keeps the sound going for 15, 30 or 60 minutes after the voice ends. Pick the sound yourself (night, rain, sea, embers or aurora) or leave it to Poly. Sounds now crossfade as they loop and fade in and out when you play or pause.
  - **Animated scenes.** Each sound has its own slow scene, with tonight's real moon, on the web, iPhone and Apple TV.

- Updated dependencies [ce66ee9]
- Updated dependencies [11dabe3]
- Updated dependencies [ed38a63]
- Updated dependencies [48eb3dc]
- Updated dependencies [ed38a63]
  - @ngriffin_uk/polychat-schemas@1.8.0
  - @ngriffin_uk/polychat-utility-core@0.7.0

## 0.4.2

### Patch Changes

- 6db0566: Discover's Reading links stay recent and local, and the evening edition keeps the morning's media.

  - **Reading is news only.** Topics with no news today no longer fill up with encyclopaedia pages, band homepages or streaming links. Discover looks back a week before giving up, and leaves out anything older than that or without a date.
  - **A short list of top reads.** Reading holds up to six links, at most two per topic, newest first, with the same story only once even when it turns up on another site or with tracking on the link.
  - **Nothing you've already opened.** Pages from your browser shape what Discover looks for but never appear as reads, and the evening edition doesn't repeat the morning's links.
  - **Closer to home.** Searches use your country and English, picked up the next time you save Discover settings.
  - **Evening keeps the morning.** Today's episode, The Perch and Your week carry over to the evening edition instead of showing as not made yet.
  - **No more "a year ago" cards.** From before now brings back flashcards you missed and links you saved, and never resurfaces archived chats.

- Updated dependencies [6db0566]
- Updated dependencies [e69d886]
  - @ngriffin_uk/polychat-utility-core@0.6.1
  - @ngriffin_uk/polychat-schemas@1.7.0

## 0.4.1

### Patch Changes

- Updated dependencies [187afde]
- Updated dependencies [d2905a6]
- Updated dependencies [0fe409a]
- Updated dependencies [0fe409a]
- Updated dependencies [e0ca7c6]
- Updated dependencies [e0ca7c6]
  - @ngriffin_uk/polychat-schemas@1.6.0
  - @ngriffin_uk/polychat-utility-core@0.6.0

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

- 6980de8: Teammates now check what they are about to do before doing it, and skills are scanned before they go live.

  - **Intent check on real effects.** Before a routine, channel reply, delegation or handoff sends a message, spends money, deletes something, handles a credential or exports data, a second check compares the call, where it lands and who started the run against what you asked for. A call that does not follow from the request, or reaches a recipient or system you never named, waits for your approval with the reason attached.
  - **Connector and MCP calls say what they do.** A connector operation or an MCP tool is classed from the flags its vendor publishes: a read-only tool runs as a read, a tool that deletes or overwrites is treated as destructive and always asks, and anything unflagged stays a write. Dry runs draft the destructive ones instead of running them.
  - **Skill scanning.** Promoting a draft skill or importing one from another scope scans it first. Instructions that try to override the assistant, hide text, act without telling you, move credentials or private data out, embed a secret or point at a private address keep the draft but block it from going live, with each problem named.

- 0a57f73: Open any file and ask about it.

  - **One viewer for every file.** Documents, sources, recordings, images and memories all open in the same viewer. The title menu holds file info, version history, share links and every conversation about the file. Files opened from a chat, a run or a task open on top of where you were.
  - **Ask about this file.** The viewer has its own conversation. Polychat reads the file fresh on every turn, can revise a document as a new revision you can restore, and keeps the conversation with the file so you can pick it up later.
  - **Poly knows the page you are on.** Each place has a guide Poly reads whenever you ask it something there, and a fresh Poly conversation opens with that guide and a few starters. Your first chat opens with the guide to conversations.
  - **API.** Pass `conversation.subject` with `{ type, id }` when creating a response to start a conversation about a source, output or memory, and list them with `GET /conversations?subject_type=&subject_id=`. `GET /skills/guides` returns each place's guide.

### Patch Changes

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

## 0.3.0

### Minor Changes

- e7177c1: The research tool now takes a brief, a depth (quick, standard or deep), a format and a provider instead of fifteen transport options, defaults to Parallel's pro processor rather than ultra, and ships with a web-research skill that sharpens vague briefs with up to three questions before a paid run.

### Patch Changes

- Updated dependencies [82c133e]
- Updated dependencies [005b9f3]
- Updated dependencies [e820856]
- Updated dependencies [7bec25b]
- Updated dependencies [65fbf81]
- Updated dependencies [65fbf81]
- Updated dependencies [b97c227]
- Updated dependencies [c965c69]
- Updated dependencies [06e4619]
- Updated dependencies [e41549c]
  - @ngriffin_uk/polychat-schemas@1.4.0

## 0.2.0

### Minor Changes

- 33133cc: Move the built-in Agent Skills into a catalogue package. `library-skills-catalogue` owns the SKILL.md documents and resources, the frontmatter schema, document parsing and the `SkillCatalog` resolver; `ai-skills` adds retrieval, resource reads and the `<skill_content>` / `<skill_resource>` formatting. The API keeps authored-skill persistence, availability and scope, and reads built-in skills and formatting from the packages.
- dd4389b: Let the model edit a large artifact without rewriting it. An artifact tagged `mode="edit"` carries FIND/REPLACE blocks, and the API applies them to the latest version of that artifact when the turn finishes, storing and sending the full updated artifact. Each FIND must match exactly once. While a reply streams the thread shows that the artifact is updating, and an edit that cannot be applied is reported rather than rendered.
- dd4389b: Let React artifacts show live data and charts. An artifact can declare read-only connector reads in a leading `<bindings>` block and read them with `usePolychatData` from `@polychat/data`. The host runs each read through the API, which takes the declaration from the stored message, refuses operations that change anything, only lets a refetch change declared arguments, caches results for a minute and rate-limits each artifact. React artifacts now compile with Sucrase instead of Babel standalone, can import `recharts`, and are assembled without string replacement, so `$` sequences and `</script>` in component source no longer corrupt the page.
- 41bb6a8: Short skills can now apply themselves to the messages they help with. A skill marked `activation: per-message` (or saved with "apply automatically") is considered before each turn and, when it clearly fits, its instructions are added to that turn only, without a `load_skill` call. Selection has a 1.5 second deadline and never blocks the reply.

### Patch Changes

- Updated dependencies [6db7a00]
- Updated dependencies [ece96c4]
- Updated dependencies [33133cc]
- Updated dependencies [b4c0c65]
- Updated dependencies [d3f1df3]
- Updated dependencies [3c23660]
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
- Updated dependencies [6966643]
- Updated dependencies [1e5cafb]
- Updated dependencies [462cbe7]
- Updated dependencies [e4ba666]
- Updated dependencies [6e76041]
- Updated dependencies [d3f1df3]
- Updated dependencies [57f8a16]
- Updated dependencies [07290f2]
- Updated dependencies [cb9ddcc]
  - @ngriffin_uk/polychat-schemas@1.2.0
