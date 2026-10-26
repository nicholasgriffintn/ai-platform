---
"@assistant/api": minor
"@ngriffin_uk/polychat-ai-providers": minor
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-library-realtime": minor
"@ngriffin_uk/polychat-library-client": minor
"@ngriffin_uk/polychat-component-shell": minor
"@ngriffin_uk/polychat-library-model-catalogue": minor
"@ngriffin_uk/polychat-utility-core": minor
"@ngriffin_uk/polychat-ai-models": patch
"@ngriffin_uk/polychat-library-react": minor
---

Workers AI Flux is now a realtime transcription provider. It runs Deepgram Flux on Cloudflare, needs no API key, and detects when you have finished speaking, so you can pick it for Live voice and dictation without any setup.

The model picker in Live now lists only live models from providers that are ready, including the transcription providers (Workers AI, GreenPT, Cartesia, Mistral and ElevenLabs), which were missing before. Leaving Live puts back the chat model you had before.

Verbatim's live line now streams from realtime transcription and builds as you speak, instead of refreshing every second. Each phrase is still checked word by word by Clef Omni once you pause.
