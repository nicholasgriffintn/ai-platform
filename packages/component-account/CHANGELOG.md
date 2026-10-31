# @ngriffin_uk/polychat-component-account

## 1.1.4

### Patch Changes

- Updated dependencies [69adfec]
  - @ngriffin_uk/polychat-library-client@0.12.0
  - @ngriffin_uk/polychat-library-react@0.13.0
  - @ngriffin_uk/polychat-schemas@1.13.0
  - @ngriffin_uk/polychat-component-ui@0.7.1

## 1.1.3

### Patch Changes

- Updated dependencies [2a427dd]
- Updated dependencies [54bf2d3]
- Updated dependencies [8642a45]
  - @ngriffin_uk/polychat-component-ui@0.7.0
  - @ngriffin_uk/polychat-library-react@0.12.0
  - @ngriffin_uk/polychat-library-client@0.11.0
  - @ngriffin_uk/polychat-schemas@1.12.0
  - @ngriffin_uk/polychat-utility-react@0.7.1
  - @ngriffin_uk/polychat-component-capabilities@1.0.5
  - @ngriffin_uk/polychat-component-models@1.2.6

## 1.1.2

### Patch Changes

- Updated dependencies [36500dd]
- Updated dependencies [dd3f0e0]
  - @ngriffin_uk/polychat-schemas@1.11.0
  - @ngriffin_uk/polychat-library-client@0.10.0
  - @ngriffin_uk/polychat-library-react@0.11.0
  - @ngriffin_uk/polychat-component-ui@0.6.3

## 1.1.1

### Patch Changes

- Updated dependencies [0af6a2b]
- Updated dependencies [766145d]
- Updated dependencies [00f22ad]
- Updated dependencies [afe0236]
- Updated dependencies [701256c]
- Updated dependencies [c79e769]
- Updated dependencies [810eff4]
- Updated dependencies [00f22ad]
  - @ngriffin_uk/polychat-schemas@1.10.0
  - @ngriffin_uk/polychat-component-models@1.2.5
  - @ngriffin_uk/polychat-library-client@0.9.0
  - @ngriffin_uk/polychat-library-react@0.10.0
  - @ngriffin_uk/polychat-utility-react@0.7.0
  - @ngriffin_uk/polychat-utility-core@0.9.0
  - @ngriffin_uk/polychat-component-ui@0.6.2
  - @ngriffin_uk/polychat-component-capabilities@1.0.4

## 1.1.0

### Minor Changes

- 8f480ac: Memories are now always kept as documents you can read and edit, and Poly finds them the way it finds your files.

  - **One kind of memory.** Polychat's own memory keeps what it learns about you, and about each project, as documents under Files › Memory. The old one-line memories are gone, so Poly starts these documents fresh.
  - **Better recall.** Memories are searched by meaning and by exact words, and Poly gets back the passage that matters rather than a whole document.
  - **Quick notes, tidied later.** When a memory document is long or has just changed, new memories are added under Recently noted straight away and folded into the document a few minutes later.
  - **Your search index, your storage.** If you keep your search index in S3 Vectors or DynamoDB Vectors, it now holds your own files as well as your memories. Choose it under Settings › Knowledge.

### Patch Changes

- Updated dependencies [5d70d5d]
- Updated dependencies [8f480ac]
  - @ngriffin_uk/polychat-schemas@1.9.0
  - @ngriffin_uk/polychat-library-client@0.8.0
  - @ngriffin_uk/polychat-library-react@0.9.0
  - @ngriffin_uk/polychat-utility-core@0.8.0
  - @ngriffin_uk/polychat-utility-react@0.6.0
  - @ngriffin_uk/polychat-component-ui@0.6.1
  - @ngriffin_uk/polychat-component-capabilities@1.0.3
  - @ngriffin_uk/polychat-component-models@1.2.4

## 1.0.2

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
  - @ngriffin_uk/polychat-component-models@1.2.3
  - @ngriffin_uk/polychat-component-capabilities@1.0.2

## 1.0.1

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
  - @ngriffin_uk/polychat-component-capabilities@1.0.1
  - @ngriffin_uk/polychat-component-models@1.2.2
  - @ngriffin_uk/polychat-component-ui@0.5.1
  - @ngriffin_uk/polychat-utility-react@0.4.1

## 1.0.0

### Major Changes

- f4841cd: Files is now one library instead of tabs inside tabs. Everything you have given Polychat, everything it made and everything it remembers sits in a single grid or list, with All, Made, Sources and Memory as quick filters.

  - Make something new from the top of Files in one click: upload, write a note, start a memory, create a folder, make a podcast episode, or open Image studio and Replicate.
  - Drop files anywhere on Files, or on a folder, to add them.
  - Every item has a menu for opening its file, copying a share link, renaming, adding it to a folder and deleting it. Results Polychat made can now be renamed and deleted too.
  - Collections are now folders, shown above your files. A podcast show is a folder with its RSS feed controls on the folder page.
  - Search filters by name as you type, and a type filter, sort order and grid or list view sit beside it. In a project, search can also look inside files.
  - Memories open on their own page, every save is a revision, and you can name them in plain words.

### Minor Changes

- 8b965f6: Polychat now speaks in the best voice your account can reach. Read-aloud, the speech tool, podcasts and video overviews all pick the highest-rated speech model you have access to, ranked by the Artificial Analysis text-to-speech arena. Add an ElevenLabs, Cartesia, Mistral or Amazon Polly key and your audio upgrades on its own.

  - New speech models: ElevenLabs Eleven v4, v4 Turbo, v3, Multilingual v2 and Flash v2.5, Cartesia Sonic 3.6, Mistral Voxtral 3 TTS and Amazon Polly Generative.
  - Audio settings now separate the provider, the model and the voice. Leave the provider on Automatic, or pick one and choose a model and voice from its list.
  - Podcasts use distinct host and guest voices on every provider, and video overviews use a narrator voice.
  - Notebook guides, Studio outputs and podcast scripts now use the medium model tier on your keys rather than the cheapest background model.

- 91c7d3d: Choose what Polychat can reach for on its own.

  - **Capabilities settings.** A new Capabilities section in Customise Chat has switches for web search and for documents and connected apps. Turn one off and Polychat stops using it by itself, including deep research for web search. Tools you pick in the composer, or that a project, teammate or recipe sets up, still work.
  - **Chat history means chat history.** Searching your earlier chats now follows the chat history switch in Memories. Turn it on if you want Polychat to look back through your previous conversations.

- 911642e: Clearer setup for plugins that connect with an API key.

  - **Callback URL.** The connect dialog shows a callback URL you can copy. If the provider asks for a callback or redirect URL when you create the key, paste this one in.
  - **One box per credential.** Plugins that need more than one value now ask for each separately. Podcast Index asks for its API key and API secret, and Audiobookshelf for its server address and API token, so there's no need to join them with a colon or bar yourself.

- 6efa93c: Plugins, Teammates and Scheduled now share the Files toolbar: type filters on the left, search beside them, and one filter menu in place of the wall of category chips.

  - Each page opens on its first type, Integrations on Plugins, instead of a mixed All view.
  - Your filters live in the address bar, so a refresh, a shared link or the back button keeps you where you were.
  - Plugins opens with an Installed row of the integrations and tools you have set up. Select one to open it, or select Installed to see only those.
  - Category and "installed only" sit in the filter menu, which lights up while either is applied.

- 91c7d3d: Choose how the assistant responds without writing a prompt.

  - **Style controls.** Personalised responses now has dropdowns for base style and tone (Professional, Friendly, Candid, Quirky, Efficient, Nerdy or Cynical), warmth, enthusiasm, emoji, and headers and lists. Leave any on Default to keep the assistant's usual behaviour.
  - **Custom instructions on top.** Your own traits and preferences sit below the controls and are added to the style you pick, so you can choose a tone and still add anything the controls do not cover. Instructions you have already written carry on working unchanged.

- 7b36da1: Sources is now where your media lives. Files' Given tab is renamed Sources and gains Podcasts, Image Studio and Replicate alongside the library.

  - Upload images, audio and video straight into Sources. Open any audio or video source to play it, transcribe it, write notes with decisions and action items, and make cover art. The transcript becomes searchable, so recordings work as grounding like any other source. This replaces the Recording Processor app.
  - Image Studio, sketch-to-painting and Replicate runs now save what they make into Sources, where it can be reused as material. They have moved out of Apps and the Canvas sidebar item into Files › Sources.
  - Make podcasts from your sources: pick sources, a format (deep dive, brief, debate or critique) and a length, and two hosts talk it through. Each episode lands in Sources with its audio, transcript, show notes and cover.
  - Group episodes into shows and create a private RSS feed link to subscribe in any podcast app. Making a new link turns off the old one.
  - Ask Poly or a teammate to make an episode with the new podcast tool, or install the Podcast Briefing recipe to get a fresh episode on your topics or Sources on a schedule.

- 7accf45: Mistral speech now runs on Voxtral 3, with a hosted voice agent for Live.

  - **Transcription.** Mistral transcription uses Voxtral Mini Transcribe 3, and you can pick Voxtral Small Transcribe 3 in Settings for higher accuracy. It detects the spoken language rather than assuming English, and timed transcripts now label who said what.
  - **Custom vocabulary.** Add names, acronyms and jargon under Settings → Audio, one per line, and Mistral transcription, live transcription and the voice agent will listen out for them.
  - **Live transcription.** Mistral live transcription uses Voxtral Mini Transcribe Realtime 3. Notes labels each speaker as they talk, and Live conversations use Mistral's own end-of-turn detection, so a thoughtful pause no longer cuts you off.
  - **Mistral Voice Agent.** Pick Mistral Voice in Live for a hosted Voxtral 3 agent that listens, searches the web when it needs to and answers aloud. It uses your Mistral key or the platform one, and you can interrupt it mid-sentence.
  - **Speech.** Mistral speech uses Voxtral TTS 3 with its new preset voices in over 20 languages. The default is Mary (English, UK). Choose how expressive the delivery is under Settings → Audio.
  - **Your voices.** Save a voice from an MP3 or WAV recording under Settings → Audio and use it for speech. Only you can use your saved voices, and you need to confirm the voice is yours or you have permission. The API offers the same through `/audio/voices`, and `/audio/speech` accepts `expressiveness`.

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
  - @ngriffin_uk/polychat-component-capabilities@1.0.0
  - @ngriffin_uk/polychat-component-ui@0.5.0
  - @ngriffin_uk/polychat-utility-react@0.4.0

## 0.3.0

### Minor Changes

- 005b9f3: Add Bedrock Managed Agents as a remote agent harness. Project chats run on the AgentCore Runtime and execution role from the workspace AWS connection, personal chats on the Runtime and role in user settings with the personal Bedrock key. It shares the OpenAI Agents session stream.

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
  - @ngriffin_uk/polychat-component-capabilities@0.4.0
  - @ngriffin_uk/polychat-component-ui@0.4.1
  - @ngriffin_uk/polychat-utility-react@0.3.1

## 0.2.2

### Patch Changes

- 1df361b: Remove unused public exports and dead helpers, consolidate duplicated duration, identifier, status, model-grouping, JSON, SMS and timing-safe comparison logic into shared modules, narrow the desktop backend option types to the interfaces each runner uses, and surface previously silent validation and rewrite failures in the UI.
- Updated dependencies [6db7a00]
- Updated dependencies [ece96c4]
- Updated dependencies [33133cc]
- Updated dependencies [4968623]
- Updated dependencies [b4c0c65]
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
  - @ngriffin_uk/polychat-library-client@0.3.0
  - @ngriffin_uk/polychat-library-react@0.4.0
  - @ngriffin_uk/polychat-component-ui@0.4.0
  - @ngriffin_uk/polychat-utility-react@0.3.0
  - @ngriffin_uk/polychat-component-models@1.1.0
  - @ngriffin_uk/polychat-component-capabilities@0.3.0

## 0.2.1

### Patch Changes

- Updated dependencies [4789c96]
- Updated dependencies [4789c96]
- Updated dependencies [505ce6a]
- Updated dependencies [4789c96]
- Updated dependencies [505ce6a]
- Updated dependencies [34380a3]
- Updated dependencies [4789c96]
- Updated dependencies [4789c96]
  - @ngriffin_uk/polychat-library-react@0.3.0
  - @ngriffin_uk/polychat-schemas@1.1.0
  - @ngriffin_uk/polychat-component-ui@0.3.0
  - @ngriffin_uk/polychat-component-capabilities@0.2.1
  - @ngriffin_uk/polychat-component-models@1.0.1

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
  - @ngriffin_uk/polychat-component-ui@0.2.0
  - @ngriffin_uk/polychat-utility-core@0.2.0
  - @ngriffin_uk/polychat-library-client@0.2.0
  - @ngriffin_uk/polychat-library-react@0.2.0
  - @ngriffin_uk/polychat-component-capabilities@0.2.0
  - @ngriffin_uk/polychat-utility-react@0.2.0
