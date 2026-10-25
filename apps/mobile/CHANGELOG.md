# @assistant/mobile

## 1.2.0

### Minor Changes

- d2905a6: Discover on the iPhone now does what it does on the web.

  - **Episodes pick up where you left off, on any device.** Where you stopped in an episode is saved to your account, so the web and the phone both resume there. Watching on the phone now counts towards tomorrow's episode being made ahead of time.
  - **Playback keeps going when you close the player.** The Perch, episodes, Your week and Wind down keep playing while you read other cards. A bar at the bottom of Home shows what is playing, with play, pause and stop.
  - **Ask about a card without leaving Home.** Asking Poly about a card opens the chat over Home, grounded in the article Discover already read, or the edition when there is no article.
  - **Save and follow from the phone.** Save a card to keep its edition past the two-week tidy, and follow a topic from its card.
  - **Earlier editions.** Home lists the last fortnight of editions, morning and evening, so yesterday's reading and this morning's edition are a tap away after the evening one arrives.
  - **What Poly is up to.** Home shows what needs you, what Poly is working on and what it has noted, and links from widgets and the Apple TV open the Perch, an episode or a card directly.
  - **Usage.** Notebook guides, Studio drafts and podcast scripts now count towards your usage like every other model call.
  - **Narration timing.** Video overviews and episodes time their pictures to the measured length of each narrated scene, so pictures change with the voice rather than drifting.

## 1.1.0

### Minor Changes

- 8b2929f: Confirm your date of birth before your first message.

  - **Asked once, at the right moment.** The first time you send a message, signed in or not, on the web, desktop or iPhone, Polychat asks for your date of birth. It keeps only whether you meet the minimum age of 18, never the date, and the answer can't be changed later.
  - **Skip if you're just looking.** Skip the question and you can keep browsing, but you can't send messages until you answer it. Polychat asks again the next time you try to send one.
  - **Why we ask.** A new page at `/age-check` explains why we ask, what we keep and your rights in the UK and EU. The Terms of Service and Privacy Policy now say plainly that Polychat is for people aged 18 or over.
  - **Same rule on the API.** Creating a response, sending input to one and calling chat completions all return 403 until the age check is done, for API keys and anonymous sessions alike. Read or record it with `GET` and `POST /auth/age`.
  - **Self-hosting.** Set `AGE_GATE_ENABLED` to `false` in your Worker vars to turn the check off completely.

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

- 1048c48: The iPhone app now knows your teammates. Open Teammates from the list menu to see who you are talking with, including groups and unread threads, or start a conversation with a teammate you have not spoken to yet. Replies in a teammate's thread now go to that teammate rather than to a plain model.

  Ask Poly is now a Siri and Shortcuts action. Say "Ask Poly in Polychat", or add the action to a shortcut and turn on Show in Share Sheet to send links and text straight to Poly's own thread.

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

- d7716ff: Polychat on Apple Watch and Apple TV, and notifications you can act on.

  - **Approve from the notification.** Task approvals arrive with Approve and Decline buttons, single questions take a typed or dictated answer, and Poly's updates take a reply, all without opening the app. They work on the Lock Screen and on Apple Watch, and approvals and questions break through Focus as time-sensitive.
  - **Poly on your wrist.** The Apple Watch app lists what needs you and what Poly is working on, approves or declines tasks and runs, answers single questions, and asks Poly anything by dictation, with the answer read aloud if you like. Sign in with one tap from a nearby iPhone, or with a code at polychat.app/device.
  - **Complications.** Put a count of what needs you, or Poly's status and next item, on any watch face. The Poly Live Activity also shows in the watch's Smart Stack.
  - **Wind down on the watch.** Play today's Discover wind down, or record a new breathing, body scan or unwind session, through AirPods with each step on screen and a tap on the wrist as it moves on. Time spent listening is saved to Apple Health as mindful minutes.
  - **Discover on Apple TV.** Today's edition, the episode with its pictures and captions full screen, wind down and every card, with the day's picks on the Top Shelf. Sign in by scanning a code with your phone. An Apple TV gets a Discover-only key, so your chats, projects and files stay out of reach, and you can revoke it from Profile.
  - **AirPlay episodes.** Episodes and wind downs show in Now Playing on the Lock Screen, Control Center and Apple Watch. Send them to an Apple TV with the AirPlay button and the current picture comes along, or mirror your screen for the full picture with captions.

## 1.0.1

### Patch Changes

- b105d00: Require budget checks and approval for deployment resumes and scale increases. Wait for provider provisioning and deletion to finish before marking dedicated deployments deleted, and expose unsupported pause controls in host capabilities.

  Claim the paid continuation after a Together upload so concurrent polls cannot create duplicate endpoints. Preserve uncertain continuation outcomes for reconciliation.

  Preserve input withdrawals on completed training outputs and check current route approval for Chat and custom evaluation judges. Pass validation data to embedding training and run GGUF conversion with checked argument lists.
