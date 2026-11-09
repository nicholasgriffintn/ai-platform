# @ngriffin_uk/polychat-library-model-catalogue

## 0.7.0

### Minor Changes

- 9d2d8c3: Perplexity's Agent API is now available as a provider. Pick Perplexity Agent in the model picker to chat with Sonar and Perplexity-hosted models, plus Claude, GPT, Gemini and Grok models served through Perplexity, using your Perplexity API key.

### Patch Changes

- 9d2d8c3: Refresh the model list against what providers actually serve. Retired and soon-to-retire models are no longer offered, and each one now explains when it goes and what to use instead. Claude Opus 4.5 is available again, and GPT Image 2.6, Gemini Omni 1.2 Flash, Nano Banana 2.1, Gemini 3.8 Flash TTS, Gemini 3.5 Transcribe and Kimi K3.1 Pro on more providers are now available. Free plans now use free models that OpenRouter still offers.
- Updated dependencies [ce24694]
- Updated dependencies [765754a]
- Updated dependencies [73a3a85]
- Updated dependencies [f6cde2d]
- Updated dependencies [074e50f]
- Updated dependencies [074e50f]
- Updated dependencies [1fcffa3]
- Updated dependencies [301c306]
- Updated dependencies [9d2d8c3]
- Updated dependencies [9d2d8c3]
- Updated dependencies [f6cde2d]
- Updated dependencies [57459ac]
  - @ngriffin_uk/polychat-schemas@1.18.0

## 0.6.0

### Minor Changes

- 150be98: See where a model handles your data before you choose it. Every model in the picker now shows a data location, and its details link to the provider's own policy for location and retention. Where a provider does not document this, the label says unknown.

### Patch Changes

- b571a91: Nano Banana Pro, SDXL Lightning, MusicGen and Hunyuan Video work again from the Replicate page, and finished predictions show their image, audio player or video. Safety settings we control no longer appear as options you can change.

  Errors are clearer: when a provider rejects a request you see the reason, and a failed run shows its banner straight away.

  Second opinion now picks reviewers from your own model tiers, always on different providers from each other, checks the answer you asked about, and tests it against what your tools actually returned. Tool results, arguments and approval details read as plain labelled text instead of raw JSON, and leaked model control text no longer reaches your replies. Inline images in chat now display, and they stay out of conversation titles.

  Your connected MCP integrations now show as ready when the assistant looks for them, and you can keep chatting after a reply that is waiting on setup.

- 79859ac: Cloudflare is retiring 24 Workers AI models on 20 November 2026, so they now show as deprecated with a suggested replacement. Built-in defaults have moved to DeepSeek V4.1 Flash, GLM 5.3, Gemma 4 26B and Qwen3.8 27B. Workers AI speech now reads Spanish with a Spanish voice and asks you to choose another speech provider for other non-English languages. New Workers AI LoRA deployments can no longer use the Gemma 2B, Gemma 7B or Llama 2 7B bases.
- Updated dependencies [5edfedc]
- Updated dependencies [fd91d91]
- Updated dependencies [150be98]
- Updated dependencies [8a4bbaf]
- Updated dependencies [d29cc10]
- Updated dependencies [150be98]
- Updated dependencies [7f6655e]
- Updated dependencies [b571a91]
- Updated dependencies [f824dd2]
- Updated dependencies [777a55e]
- Updated dependencies [5a2391a]
- Updated dependencies [e68f76a]
- Updated dependencies [79859ac]
  - @ngriffin_uk/polychat-schemas@1.17.0

## 0.5.0

### Minor Changes

- 00f22ad: Workers AI Flux is now a realtime transcription provider. It runs Deepgram Flux on Cloudflare, needs no API key, and detects when you have finished speaking, so you can pick it for Live voice and dictation without any setup.

  The model picker in Live now lists only live models from providers that are ready, including the transcription providers (Workers AI, GreenPT, Cartesia, Mistral and ElevenLabs), which were missing before. Leaving Live puts back the chat model you had before.

  Verbatim's live line now streams from realtime transcription and builds as you speak, instead of refreshing every second. Each phrase is still checked word by word by Clef Omni once you pause.

### Patch Changes

- afe0236: GPT-6 Luna and GPT-6 Astra now send reasoning through the Responses API, so the highest reasoning effort no longer fails with an unsupported value error.
- Updated dependencies [0af6a2b]
- Updated dependencies [afe0236]
- Updated dependencies [c79e769]
- Updated dependencies [810eff4]
- Updated dependencies [00f22ad]
  - @ngriffin_uk/polychat-schemas@1.10.0

## 0.4.0

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

## 0.3.0

### Minor Changes

- 65fbf81: Add the newest live models. Gemini 3.5 Transcribe Live runs transcription sessions (so Notes dictation can use Gemini) and Gemini 3.5 Live Translate runs translation sessions, both through the existing Live API token flow. GPT-Live 1 joins the OpenAI realtime models as a server-brokered WebRTC call with Responses delegation, so the browser never holds a project key.
- 65fbf81: Refresh the realtime providers and Note Taker. Notes dictation now runs on the shared live session with any ready transcription provider and commits OpenAI turns on silence. Gemini Live defaults to Gemini 3.8 Live, OpenAI transcription sends the `languages` field and drops the retired Whisper and GPT-4o models, translation sessions use the dedicated translations endpoints, and proxied transcription sessions settle billing on their measured audio instead of a flat reservation. The proxy audio cap now covers the full session length, Notes lists return excerpts with server-side search, metadata is only described once a note has enough text, and the unused video analysis options are gone.

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

- ece96c4: Move the model catalogue and model policy out of the API. `library-model-catalogue` owns the models.dev data, its schema and the sync script, and `ai-models` owns lookups, tier and lineup resolution, credential authority, reasoning and verbosity rules. The API loads models from these packages and the `sync-models-dev` workflow runs from the catalogue package.
- 462cbe7: Record how long providers keep API prompts and replies. Model configs gain an optional `dataRetention` block with the documented maximum days, how zero retention is reached (`default`, `account_setting` or `on_request`) and the policy URL. OpenAI, Azure OpenAI, Anthropic, Gemini API, Groq, Mistral and Bedrock carry their published defaults, and the model picker's hover preview shows them with a link to the policy.

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
