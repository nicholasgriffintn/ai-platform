---
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-ai-integrations": minor
"@ngriffin_uk/polychat-utility-core": minor
"@ngriffin_uk/polychat-component-shell": minor
"@assistant/api": minor
"@assistant/app": minor
---

Discover gathers before it writes, and Poly reads your own services without asking.

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
- **A real feed.** Discover now reads the day's headlines for where you are and, when Reddit is connected, the best posts from your communities. Every interest is researched from the news of the last three days, with the publisher and date kept. Poly's picks lead the edition, and up to three stories per interest and from Reddit fill the Reading section beneath them, never repeating a link you have already seen. Your recent chats only shape the edition when nothing else is known about you yet.
- **Discover reads the articles, not just the headlines.** Each page the overnight research finds is read in full and filed in the Discover notebook, and the edition is written from what the pages actually say, in plain prose rather than page markup. Opening a read card talks to the filed article, so Poly can give you the gist or the other side without fetching anything, and cards show the site's icon. Newsletters and Reddit posts carry their text too, so a card can tell you what happened rather than that something did.
- **An edition is never lost to one bad link.** A page the feed cannot show as a card, such as a plain http address, is left out rather than making the whole edition unreadable, and an edition is checked before it is saved so a problem names the exact card.
- **Failures say why.** A service that answers with an error, including a rate limit, is recorded as a failed read with the reason, and a connector that cannot be reached says what went wrong.
- **Discover documents explain themselves.** Each service's document in the Discover notebook now reads as a page: when it was read, what was found, and the raw result underneath. A service that could not be read says why. YouTube is read as your subscriptions and recent likes rather than your own uploads.
- **Fixes.** The first edition after enabling Discover now gathers from your services before it is written, instead of being composed from recent chat titles alone. The Perch's captions follow the audio instead of jumping to the end, and loading a skill with a leading slash in its path no longer fails.
