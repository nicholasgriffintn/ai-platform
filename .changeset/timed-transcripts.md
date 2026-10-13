---
"@ngriffin_uk/polychat-utility-core": minor
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-ai-providers": minor
"@ngriffin_uk/polychat-library-prompts-catalogue": patch
"@ngriffin_uk/polychat-component-experiences": minor
"@ngriffin_uk/polychat-component-shell": patch
"@ngriffin_uk/polychat-library-client": patch
"@assistant/api": patch
---

Keep transcription timings. Providers return segments and words, `/audio/transcribe?timestamps=true` includes them, notes from media quote real `[m:ss]` markers instead of guessing, and recordings play captions and download them as SRT or VTT.
