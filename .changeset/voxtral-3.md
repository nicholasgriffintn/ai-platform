---
"@ngriffin_uk/polychat-ai-providers": minor
"@ngriffin_uk/polychat-component-account": minor
"@ngriffin_uk/polychat-component-shell": minor
"@ngriffin_uk/polychat-library-client": minor
"@ngriffin_uk/polychat-library-react": minor
"@ngriffin_uk/polychat-library-realtime": minor
"@ngriffin_uk/polychat-schemas": minor
"@assistant/api": minor
---

Mistral speech now runs on Voxtral 3, with a hosted voice agent for Live.

- **Transcription.** Mistral transcription uses Voxtral Mini Transcribe 3, and you can pick Voxtral Small Transcribe 3 in Settings for higher accuracy. It detects the spoken language rather than assuming English, and timed transcripts now label who said what.
- **Custom vocabulary.** Add names, acronyms and jargon under Settings → Audio, one per line, and Mistral transcription, live transcription and the voice agent will listen out for them.
- **Live transcription.** Mistral live transcription uses Voxtral Mini Transcribe Realtime 3. Notes labels each speaker as they talk, and Live conversations use Mistral's own end-of-turn detection, so a thoughtful pause no longer cuts you off.
- **Mistral Voice Agent.** Pick Mistral Voice in Live for a hosted Voxtral 3 agent that listens, searches the web when it needs to and answers aloud. It uses your Mistral key or the platform one, and you can interrupt it mid-sentence.
- **Speech.** Mistral speech uses Voxtral TTS 3 with its new preset voices in over 20 languages. The default is Mary (English, UK). Choose how expressive the delivery is under Settings → Audio.
- **Your voices.** Save a voice from an MP3 or WAV recording under Settings → Audio and use it for speech. Only you can use your saved voices, and you need to confirm the voice is yours or you have permission. The API offers the same through `/audio/voices`, and `/audio/speech` accepts `expressiveness`.
