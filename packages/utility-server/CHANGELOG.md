# @ngriffin_uk/polychat-utility-server

## 0.6.1

### Patch Changes

- Updated dependencies [0af6a2b]
- Updated dependencies [afe0236]
- Updated dependencies [c79e769]
- Updated dependencies [810eff4]
- Updated dependencies [00f22ad]
  - @ngriffin_uk/polychat-schemas@1.10.0
  - @ngriffin_uk/polychat-utility-core@0.9.0

## 0.6.0

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

### Patch Changes

- Updated dependencies [5d70d5d]
- Updated dependencies [8f480ac]
  - @ngriffin_uk/polychat-schemas@1.9.0
  - @ngriffin_uk/polychat-utility-core@0.8.0

## 0.5.0

### Minor Changes

- 48eb3dc: Everything Polychat gathers from outside now lands in one knowledge base, and you can follow feeds and topics yourself.

  - **Follow feeds and topics.** Use the Follow tile in Files, yours or a project's, or the Follow tab when adding sources to a notebook. Pick an RSS or Atom feed, a news topic or a web topic, and new pages arrive as sources on a schedule. Followed items sit in the same place with Read now, Pause and Stop following.
  - **Pages are filed once.** Discover, notebook research, followed topics and stored page extracts share one copy of each page per personal library or project, so the same article is no longer read, summarised and indexed again for every feature.
  - **Your feeds come first.** Discover and topic syncs check the feeds you follow before searching the web, and only widen the search when nothing fresh turns up.
  - **Notebook syncs show their documents.** Documents synced from a connection into a personal notebook are no longer hidden.

### Patch Changes

- Updated dependencies [ce66ee9]
- Updated dependencies [11dabe3]
- Updated dependencies [ed38a63]
- Updated dependencies [48eb3dc]
- Updated dependencies [ed38a63]
  - @ngriffin_uk/polychat-schemas@1.8.0
  - @ngriffin_uk/polychat-utility-core@0.7.0

## 0.4.0

### Minor Changes

- 187afde: When a provider says your credits have run out, Polychat stops sending it work and moves on to the next model you have access to. Chats and scheduled routines that use an automatic model tier carry on with the next model in that tier mid-run. Speech renders switch to your next-best voice and finish, rather than failing until the month resets.

  - A model you picked yourself is never swapped. If its provider is out of credit, the error is shown.
  - Episodes, podcasts, video overviews and wind downs restart on the new voice, so one recording never mixes two voices.
  - ElevenLabs, OpenRouter and DeepSeek balances are checked in the background. The provider comes back as soon as your credits reset or you top up.
  - Keys that can't read their own balance, such as an ElevenLabs key limited to text to speech, get another try 15 minutes later. A refused request costs no credits, and if it is still empty your audio carries on with the next voice.
  - Saving a new key for a provider clears its out-of-credits state straight away.

### Patch Changes

- e0ca7c6: Memories are kept as whole documents, and what Polychat gathers is summarised rather than pasted.

  - **One document per subject.** When Polychat remembers something with document memory, it files it into the memory document for that subject, or starts a new one, instead of adding a line to a single list. The whole document is rewritten each time: what to remember, why, and how it should shape future answers, with links to related memories. A newer fact replaces the one it contradicts.
  - **Memories say what they hold.** Each memory document has a one-line description and a kind: about you, how to work with you, ongoing work, or where to find things. Poly picks memories by those descriptions, and you can see them under File info.
  - **Summaries for gathered reading.** Pages Discover reads and the browsing your Mac shares are recorded with a summary of what each page says and its key points, rather than its opening lines. Discover keeps the whole page in its notebook. Documents also get a summary when they are added or change, so when a notebook is too big to read in full, guides, Studio and episodes get a summary of every source instead of only the first few.
  - **Service documents are easier to read.** Each service's document in the Discover notebook lists what was found without the raw response underneath.

- Updated dependencies [187afde]
- Updated dependencies [d2905a6]
- Updated dependencies [0fe409a]
- Updated dependencies [0fe409a]
- Updated dependencies [e0ca7c6]
- Updated dependencies [e0ca7c6]
  - @ngriffin_uk/polychat-schemas@1.6.0
  - @ngriffin_uk/polychat-utility-core@0.6.0

## 0.3.0

### Minor Changes

- 80fee8e: MCP tools can now show their own interface in a conversation, and Polychat can be used as a tool from other assistants.

  - **Apps inside the chat.** When a connected MCP integration ships an interface for a tool (the MCP Apps extension), Polychat renders it in the reply in a sandboxed frame: pickers, tables, small dashboards. The app can refresh its own data through read-only tools; anything that would change something still goes through the conversation so it can ask you first.
  - **Polychat as an MCP server.** Point Claude, ChatGPT, Codex or any MCP client at the /mcp endpoint with a Polychat API key and it can run the same tools you can run in Polychat, and ask any of your teammates to take on a job. Anything that needs approval waits for you in Polychat.

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

## 0.2.1

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

## 0.2.0

### Minor Changes

- ece96c4: Add the provider primitives package and move every provider implementation into it. `ProviderLibrary` owns categorised bootstrapping, alias and lifecycle resolution, per-category decorators, and host error mapping, and providers receive a `ProviderRuntime` (`ProviderHost` plus a resolver for sibling providers) instead of importing host modules. Platform credential detection, user-versus-platform API key resolution, and provider fallback move there from the API. `utility-server` holds the server helpers those providers share, and the API and sandbox Workers resolve providers through the library.
- d25fd94: Let people reach Polychat by email. A personal email binding is keyed by the address you write from, linked with the usual one-time command, and answered by threaded plain-text replies. Inbound mail arrives through the Worker email handler and is only accepted when a DKIM signature aligned with its From domain also covers the To or Cc header naming Polychat's inbox, so forged senders and replayed messages are refused. Auto-replies are ignored to avoid loops.

### Patch Changes

- 4968623: Add the sandbox primitives. `library-sandbox` collects the mechanisms the API, sandbox Worker and computer Worker each carried: the dynamic Worker evaluation template and content-addressed code ids, outbound policy with a virtual tools origin, lease fences, HMAC-signed grants, execution control with pause and cancel, output redaction and request helpers. `ai-sandbox` composes them over Cloudflare's Worker Loader into `createEvaluator`, the loopback `OutboundGateway` entrypoint and `createCodeMode`. The API gains the `run_code` tool (backed by the `LOADER` binding) that runs model-written JavaScript in a fresh isolate and routes `tools.<name>(args)` calls back through the function registry. The computer Worker now fences leases and signs screen grants through the library and reports stale leases by code; the sandbox Worker uses the shared execution control, cancellation and redaction, and verifies JWTs with `@ngriffin_uk/auth-jwt` instead of a hand-rolled HS256 check.
- 5ead2cc: Import GitHub and Linear issues into Work and review exact GitHub PR revisions manually or through signed automatic intake. Retain captured Sources and review Outputs, isolate each workspace and credential owner, and approve publication separately.

  Apply migration `0061_project_task_integrations` before deployment. Configure the GitHub webhook secret and pull-request events for automatic intake, and pull-request write permission for publication.

- b105d00: Verify every published upload file before inspection, including files without Hub hashes, and mark failed publications accurately. Respect pause and delete requests before provisioning, schedule resumed deployments, and calculate idle time from usage and resume events instead of background polling. Validate dataset byte ranges and restrict credentials during redirected downloads.

  Keep route revocations in force until explicit re-approval, record withdrawals for automatically allowed models, and retire affected routes during erasure without revoking the clean dataset revision.

- b105d00: Strip authentication headers when following a redirect to another origin. Preserve HEAD requests on 303 redirects and clear body headers when converting a request to GET.
- 57f8a16: Add Sites, a generative site builder that works from one brief. Jev classifies the brief into a plan (kind, scope, tone, palette, model tier), a tier-selected coding model streams the site as JSON Patch lines against a guardrailed component catalogue, and the shell renders every patch the moment it lands. `library-sites` holds the catalogue, patch stream compiler, validator and repair, prompt assembly, theme tokens and a deterministic Next.js and Tailwind code generator; `component-sites` holds the live React registry, themed preview and code view. Sites persist as revisioned outputs, refine in follow-ups, export as runnable project files, and hand off to a project's sandbox for a full build. The SSE buffer parser now lives once in `utility-core`. Sites are interactive (state, bindings, visibility, repeat, filters and actions in both the live renderer and the generated code), editable in place through an element inspector with zero-token edits and scoped refinement, exportable straight to a pull request with generated images, embeddable in chat through the `build_site` tool, revisioned with restore and public preview links, and judged by Jev at planning, refinement, quality-scoring and prompt-evaluation time.
- Updated dependencies [6db7a00]
- Updated dependencies [ece96c4]
- Updated dependencies [33133cc]
- Updated dependencies [4968623]
- Updated dependencies [b4c0c65]
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
- Updated dependencies [6966643]
- Updated dependencies [1e5cafb]
- Updated dependencies [462cbe7]
- Updated dependencies [e4ba666]
- Updated dependencies [1df361b]
- Updated dependencies [6e76041]
- Updated dependencies [d3f1df3]
- Updated dependencies [57f8a16]
- Updated dependencies [07290f2]
- Updated dependencies [cb9ddcc]
  - @ngriffin_uk/polychat-schemas@1.2.0
  - @ngriffin_uk/polychat-utility-core@0.3.0
