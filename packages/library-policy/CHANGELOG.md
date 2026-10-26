# @ngriffin_uk/polychat-library-policy

## 0.5.0

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

## 0.4.0

### Minor Changes

- 91c7d3d: Choose what Polychat can reach for on its own.

  - **Capabilities settings.** A new Capabilities section in Customise Chat has switches for web search and for documents and connected apps. Turn one off and Polychat stops using it by itself, including deep research for web search. Tools you pick in the composer, or that a project, teammate or recipe sets up, still work.
  - **Chat history means chat history.** Searching your earlier chats now follows the chat history switch in Memories. Turn it on if you want Polychat to look back through your previous conversations.

## 0.3.0

### Minor Changes

- 7bec25b: Add Polychat Benchmarks: GeoGuess, Countdown, Fermi Bets, Long Odds, Hamster Wheel and Strudel Groove, run on one engine for official, personal and workspace scopes. Results at `/benchmarks` show intervals, Artificial Analysis indexes with attribution, measured cost and a medal table, people can play the auto-scored benchmarks and vote on blind pairs, the Benchmarks app runs them against your own models and keys, and the model selector previews each model's standings.

## 0.2.0

### Minor Changes

- 67b52ed: Let people approve a Poly write once and for all, for one destination. When Poly at the assistant level waits on a write with a known destination, the approval card offers "Always allow here". The server derives the tool and destination from the stored pending call and keeps the approval on the Poly context for thirty days, where a Cedar condition lets matching writes run unattended. Sends, spending, deletes, credentials and exports still ask every time. Approvals are listed in Poly's autonomy menu and can be revoked there.
- 07290f2: Add a teammate autonomy dial. A teammate context can be an observer, an assistant or a partner, enforced by Cedar over each call's effect class: observers only read and draft, assistants ask before writes, partners write within their grants, and sends, spending, deletes, credentials and exports always ask. Poly starts as an assistant and its overlay can change the level. Run triggers now reach tool availability and execution, so Poly's navigation gate holds there too.

### Patch Changes

- 6966643: Grant selected actions from existing connectors directly to projects through Plugins, without creating a recipe. Reuse personal accounts, the connector catalogue, project capabilities and existing execution approvals. Preserve exclusions and narrower recipe permissions.
