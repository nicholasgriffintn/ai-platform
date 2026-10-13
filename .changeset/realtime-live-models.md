---
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-ai-providers": minor
"@ngriffin_uk/polychat-library-model-catalogue": minor
"@ngriffin_uk/polychat-library-realtime": minor
"@ngriffin_uk/polychat-library-react": minor
"@assistant/api": minor
"@assistant/app": minor
---

Add the newest live models. Gemini 3.5 Transcribe Live runs transcription sessions (so Notes dictation can use Gemini) and Gemini 3.5 Live Translate runs translation sessions, both through the existing Live API token flow. GPT-Live 1 joins the OpenAI realtime models as a server-brokered WebRTC call with Responses delegation, so the browser never holds a project key.
