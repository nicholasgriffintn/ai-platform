# @ngriffin_uk/polychat-ai-functions

## 0.3.7

### Patch Changes

- Updated dependencies [69adfec]
  - @ngriffin_uk/polychat-ai-providers@0.9.0
  - @ngriffin_uk/polychat-schemas@1.13.0

## 0.3.6

### Patch Changes

- Updated dependencies [2a427dd]
- Updated dependencies [54bf2d3]
  - @ngriffin_uk/polychat-schemas@1.12.0
  - @ngriffin_uk/polychat-ai-models@0.5.0
  - @ngriffin_uk/polychat-ai-providers@0.8.0
  - @ngriffin_uk/polychat-ai-prompts@0.6.1

## 0.3.5

### Patch Changes

- Updated dependencies [36500dd]
- Updated dependencies [dd3f0e0]
  - @ngriffin_uk/polychat-schemas@1.11.0
  - @ngriffin_uk/polychat-ai-models@0.4.0
  - @ngriffin_uk/polychat-ai-providers@0.7.0

## 0.3.4

### Patch Changes

- Updated dependencies [0af6a2b]
- Updated dependencies [afe0236]
- Updated dependencies [c79e769]
- Updated dependencies [810eff4]
- Updated dependencies [00f22ad]
  - @ngriffin_uk/polychat-schemas@1.10.0
  - @ngriffin_uk/polychat-ai-prompts@0.6.0
  - @ngriffin_uk/polychat-utility-core@0.9.0
  - @ngriffin_uk/polychat-ai-providers@0.6.0
  - @ngriffin_uk/polychat-ai-models@0.3.4
  - @ngriffin_uk/polychat-library-tools@0.4.4
  - @ngriffin_uk/polychat-utility-server@0.6.1

## 0.3.3

### Patch Changes

- Updated dependencies [5d70d5d]
- Updated dependencies [8f480ac]
  - @ngriffin_uk/polychat-schemas@1.9.0
  - @ngriffin_uk/polychat-utility-core@0.8.0
  - @ngriffin_uk/polychat-utility-server@0.6.0
  - @ngriffin_uk/polychat-ai-models@0.3.3
  - @ngriffin_uk/polychat-library-tools@0.4.3
  - @ngriffin_uk/polychat-ai-prompts@0.5.1
  - @ngriffin_uk/polychat-ai-providers@0.5.2

## 0.3.2

### Patch Changes

- Updated dependencies [ce66ee9]
- Updated dependencies [11dabe3]
- Updated dependencies [ed38a63]
- Updated dependencies [48eb3dc]
- Updated dependencies [ed38a63]
  - @ngriffin_uk/polychat-schemas@1.8.0
  - @ngriffin_uk/polychat-ai-prompts@0.5.0
  - @ngriffin_uk/polychat-utility-server@0.5.0
  - @ngriffin_uk/polychat-utility-core@0.7.0
  - @ngriffin_uk/polychat-ai-providers@0.5.1
  - @ngriffin_uk/polychat-ai-models@0.3.2
  - @ngriffin_uk/polychat-library-tools@0.4.2

## 0.3.1

### Patch Changes

- Updated dependencies [187afde]
- Updated dependencies [d2905a6]
- Updated dependencies [0fe409a]
- Updated dependencies [0fe409a]
- Updated dependencies [e0ca7c6]
- Updated dependencies [e0ca7c6]
- Updated dependencies [187afde]
  - @ngriffin_uk/polychat-schemas@1.6.0
  - @ngriffin_uk/polychat-utility-core@0.6.0
  - @ngriffin_uk/polychat-utility-server@0.4.0
  - @ngriffin_uk/polychat-ai-providers@0.5.0
  - @ngriffin_uk/polychat-ai-prompts@0.4.1
  - @ngriffin_uk/polychat-library-tools@0.4.1
  - @ngriffin_uk/polychat-ai-models@0.3.1

## 0.3.0

### Minor Changes

- 8b965f6: Polychat now speaks in the best voice your account can reach. Read-aloud, the speech tool, podcasts and video overviews all pick the highest-rated speech model you have access to, ranked by the Artificial Analysis text-to-speech arena. Add an ElevenLabs, Cartesia, Mistral or Amazon Polly key and your audio upgrades on its own.

  - New speech models: ElevenLabs Eleven v4, v4 Turbo, v3, Multilingual v2 and Flash v2.5, Cartesia Sonic 3.6, Mistral Voxtral 3 TTS and Amazon Polly Generative.
  - Audio settings now separate the provider, the model and the voice. Leave the provider on Automatic, or pick one and choose a model and voice from its list.
  - Podcasts use distinct host and guest voices on every provider, and video overviews use a narrator voice.
  - Notebook guides, Studio outputs and podcast scripts now use the medium model tier on your keys rather than the cheapest background model.

- 7accf45: Pull typed values out of text and images with Cloudflare's Clairic.

  - **Extraction models.** Clairic joins the catalogue as the first extraction model. Give it some text, or up to four images, and a list of named fields, and it returns each one as the type you asked for: a span of the text, a number, a date, a duration, a list, or an estimate or forecast with an 80% range. Anything the input does not say comes back empty with a best guess, never made up.
  - **`POST /extractions`.** Send `state`, `fields` and optional `images` and `reference_date`. Every scalar answer carries `confidence` and `p_null`, so you can decide in code which values to trust.
  - **Extract values tool.** Chat, Poly and automations can call `extract_values` to read order numbers, totals and dates from an email or invoice in one fast call, then hand the values to `decide`.
  - **Paperwork.** A new app for receipts, invoices and damage claims. Drop in photos or paste text, and each figure comes back with a confidence, the source highlighted where it was found, a running total and a CSV export.

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
  - @ngriffin_uk/polychat-library-tools@0.4.0
  - @ngriffin_uk/polychat-utility-server@0.3.0
  - @ngriffin_uk/polychat-ai-prompts@0.4.0

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
  - @ngriffin_uk/polychat-ai-providers@0.3.0
  - @ngriffin_uk/polychat-schemas@1.4.0
  - @ngriffin_uk/polychat-ai-prompts@0.3.0
  - @ngriffin_uk/polychat-library-tools@0.3.1
  - @ngriffin_uk/polychat-utility-server@0.2.1
  - @ngriffin_uk/polychat-ai-models@0.2.1

## 0.2.0

### Minor Changes

- ece96c4: Add the AI function, agent, tool, workflow and task primitives. `ai-functions` exposes task-shaped calls (`generateText`, `generateObject`, `classify`, `extract`, media and retrieval) over a provider runtime. `ai-agents` builds `Agent` on the decision loop and tool catalogues, and replaces `agent-core` in every host. `library-tools` replaces `library-tool-runtime` and the tool registry schema with definitions, catalogues, validation and execution. `library-tasks` adds outcome settlement, execution leases, handler registries, polling and cron schedules and status machines, and `ai-workflows` wraps them in `on`/`poll`/`every` so the API declares queued tasks, self-rescheduling pollers (now with an attempt cap) and cron jobs in one registry.
- 33133cc: Centralise every authored prompt in a catalogue and a retrieval package. `library-prompts-catalogue` holds all prompt text and fragments as data with a validating schema, variables and conditionals; `ai-prompts` retrieves entries by id, task or variant, renders `{{variable}}` templates, and composes the chat, meta-assistant, sandbox, memory, document, agent, sandbox-worker, provider and panel prompts. Hardcoded prompts are removed from `ai-providers` (image styles and guardrail policies), `ai-functions` (task system prompts), `ai-agents`, `schemas` (council member prompts, teammate and platform teammate briefs) and the API and sandbox worker services, which now source their text from the catalogue.

### Patch Changes

- Updated dependencies [6db7a00]
- Updated dependencies [ece96c4]
- Updated dependencies [ece96c4]
- Updated dependencies [33133cc]
- Updated dependencies [ece96c4]
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
  - @ngriffin_uk/polychat-ai-providers@0.2.0
  - @ngriffin_uk/polychat-schemas@1.2.0
  - @ngriffin_uk/polychat-ai-models@0.2.0
  - @ngriffin_uk/polychat-library-tools@0.3.0
  - @ngriffin_uk/polychat-ai-prompts@0.2.0
  - @ngriffin_uk/polychat-utility-server@0.2.0
  - @ngriffin_uk/polychat-utility-core@0.3.0
