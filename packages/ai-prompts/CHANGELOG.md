# @ngriffin_uk/polychat-ai-prompts

## 0.5.1

### Patch Changes

- Updated dependencies [5d70d5d]
  - @ngriffin_uk/polychat-library-prompts-catalogue@0.7.0
  - @ngriffin_uk/polychat-utility-core@0.8.0

## 0.5.0

### Minor Changes

- 11dabe3: See how the news is framed before you trust it.

  - **How it's framed.** A Discover read has a How it's framed button. It shows the article's slant and tone, who it relies on, any loaded wording (quoted exactly as written) and what it leaves out, plus a writing grade. It is kept with the article, so opening it again costs nothing.
  - **Compare the coverage.** A Discover topic with two or more articles that day can compare them: what every outlet agrees on, each outlet's angle, where they differ and what none of them mention. The comparison is filed in your Discover notebook.
  - **Article analysis speaks the same language.** Article analysis in Apps now uses the same framing check, so its reports describe framing and omissions rather than labelling pieces left or right.
  - Both count towards your monthly Discover budget and stop when it is spent.

### Patch Changes

- Updated dependencies [11dabe3]
- Updated dependencies [ed38a63]
  - @ngriffin_uk/polychat-library-prompts-catalogue@0.6.0
  - @ngriffin_uk/polychat-utility-core@0.7.0

## 0.4.1

### Patch Changes

- Updated dependencies [187afde]
- Updated dependencies [d2905a6]
- Updated dependencies [0fe409a]
- Updated dependencies [e0ca7c6]
  - @ngriffin_uk/polychat-utility-core@0.6.0
  - @ngriffin_uk/polychat-library-prompts-catalogue@0.5.0

## 0.4.0

### Minor Changes

- 91c7d3d: Choose how the assistant responds without writing a prompt.

  - **Style controls.** Personalised responses now has dropdowns for base style and tone (Professional, Friendly, Candid, Quirky, Efficient, Nerdy or Cynical), warmth, enthusiasm, emoji, and headers and lists. Leave any on Default to keep the assistant's usual behaviour.
  - **Custom instructions on top.** Your own traits and preferences sit below the controls and are added to the style you pick, so you can choose a tone and still add anything the controls do not cover. Instructions you have already written carry on working unchanged.

### Patch Changes

- Updated dependencies [8b2929f]
- Updated dependencies [7accf45]
- Updated dependencies [bf39c94]
- Updated dependencies [1fe4222]
- Updated dependencies [06c02dd]
- Updated dependencies [f4841cd]
- Updated dependencies [8b965f6]
- Updated dependencies [11381a9]
- Updated dependencies [91c7d3d]
- Updated dependencies [7b36da1]
  - @ngriffin_uk/polychat-utility-core@0.5.0
  - @ngriffin_uk/polychat-library-prompts-catalogue@0.4.0

## 0.3.0

### Minor Changes

- 65fbf81: Refresh the realtime providers and Note Taker. Notes dictation now runs on the shared live session with any ready transcription provider and commits OpenAI turns on silence. Gemini Live defaults to Gemini 3.8 Live, OpenAI transcription sends the `languages` field and drops the retired Whisper and GPT-4o models, translation sessions use the dedicated translations endpoints, and proxied transcription sessions settle billing on their measured audio instead of a flat reservation. The proxy audio cap now covers the full session length, Notes lists return excerpts with server-side search, metadata is only described once a note has enough text, and the unused video analysis options are gone.

### Patch Changes

- Updated dependencies [82c133e]
- Updated dependencies [393652d]
- Updated dependencies [7e757d4]
- Updated dependencies [7bec25b]
- Updated dependencies [65fbf81]
- Updated dependencies [b97c227]
- Updated dependencies [c965c69]
- Updated dependencies [04c071a]
- Updated dependencies [06e4619]
- Updated dependencies [e41549c]
  - @ngriffin_uk/polychat-utility-core@0.4.0
  - @ngriffin_uk/polychat-library-prompts-catalogue@0.3.0

## 0.2.0

### Minor Changes

- 33133cc: Centralise every authored prompt in a catalogue and a retrieval package. `library-prompts-catalogue` holds all prompt text and fragments as data with a validating schema, variables and conditionals; `ai-prompts` retrieves entries by id, task or variant, renders `{{variable}}` templates, and composes the chat, meta-assistant, sandbox, memory, document, agent, sandbox-worker, provider and panel prompts. Hardcoded prompts are removed from `ai-providers` (image styles and guardrail policies), `ai-functions` (task system prompts), `ai-agents`, `schemas` (council member prompts, teammate and platform teammate briefs) and the API and sandbox worker services, which now source their text from the catalogue.
- 67b52ed: Give Poly an agenda. `GET /poly/agenda` derives what needs the person, what Poly is working on and what it finished this week from the Poly thread's delegations, goal and latest run, with no new storage. Poly's prompt carries the agenda each turn, the overlay shows it above the thread, and the sidebar's Ask Poly button shows Poly's status. The agenda refreshes on the live delegation, goal and run events for the Poly thread.
- 67b52ed: Budget Poly's interruptions. Routines Poly sets up from its thread now report back to it, and each routine result passes through a judged, budgeted handoff before it reaches the person: results waiting on them always interrupt, failures and results a decision policy rates as urgent interrupt within five a day and thirty minutes apart, and everything else is noted quietly. Each occurrence is decided once and recorded as a `poly.handoffs` activity on the Poly thread, and the agenda, Poly's prompt and the overlay list what was noted and why.
- ee31a6d: Call the Poly by its name everywhere. The `meta` conversation type is now `poly`, the `meta_assistant` request field is now `poly`, and the meta assistant contracts, prompts, tools, hooks and overlay are renamed to match (`POLY_NAVIGATION_TOOL_NAMES`, `polyRequestSchema`, `buildPolyPrompt`, `PolyOverlay`, `usePolyNavigation`). A data migration moves stored `meta` conversations to `poly`. Behaviour is unchanged.
- ee31a6d: Let Poly do things in its thread. Poly's grants now cover delegation, goals, memory, research, documents, notes, skills and automations alongside navigation, its thread uses the standard chat prompt with its persona and memory, and `buildStandardChatPrompt` takes a `poly` option that adds Poly's behaviour and the person's current place. `buildPolyPrompt` is removed.

### Patch Changes

- Updated dependencies [33133cc]
- Updated dependencies [4968623]
- Updated dependencies [297b848]
- Updated dependencies [462cbe7]
- Updated dependencies [b105d00]
- Updated dependencies [d25fd94]
- Updated dependencies [462cbe7]
- Updated dependencies [c126d04]
- Updated dependencies [90f7110]
- Updated dependencies [67b52ed]
- Updated dependencies [67b52ed]
- Updated dependencies [ee31a6d]
- Updated dependencies [ee31a6d]
- Updated dependencies [ee31a6d]
- Updated dependencies [1df361b]
- Updated dependencies [57f8a16]
  - @ngriffin_uk/polychat-library-prompts-catalogue@0.2.0
  - @ngriffin_uk/polychat-utility-core@0.3.0
