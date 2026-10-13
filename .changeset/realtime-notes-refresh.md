---
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-ai-providers": minor
"@ngriffin_uk/polychat-ai-prompts": minor
"@ngriffin_uk/polychat-library-prompts-catalogue": minor
"@ngriffin_uk/polychat-library-model-catalogue": minor
"@ngriffin_uk/polychat-library-realtime": minor
"@ngriffin_uk/polychat-library-react": minor
"@ngriffin_uk/polychat-library-client": minor
"@ngriffin_uk/polychat-component-experiences": minor
"@ngriffin_uk/polychat-component-shell": minor
"@assistant/api": minor
"@assistant/app": minor
---

Refresh the realtime providers and Note Taker. Notes dictation now runs on the shared live session with any ready transcription provider and commits OpenAI turns on silence. Gemini Live defaults to Gemini 3.8 Live, OpenAI transcription sends the `languages` field and drops the retired Whisper and GPT-4o models, translation sessions use the dedicated translations endpoints, and proxied transcription sessions settle billing on their measured audio instead of a flat reservation. The proxy audio cap now covers the full session length, Notes lists return excerpts with server-side search, metadata is only described once a note has enough text, and the unused video analysis options are gone.
