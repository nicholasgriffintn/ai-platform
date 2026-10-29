---
"@assistant/api": minor
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-library-chat": minor
"@ngriffin_uk/polychat-library-client": minor
"@ngriffin_uk/polychat-library-react": minor
"@ngriffin_uk/polychat-component-shell": minor
"@ngriffin_uk/polychat-library-prompts-catalogue": patch
---

Memories now keep the words they came from. Each new memory records a quote from your message and the chat it was in, and the memory's version history in Files shows it beside each change. Ask Polychat why it remembers something and it can answer with the quote.

You can also bring your memory over from another assistant. In Files, start a new memory and choose Bring memory over from another assistant. Drop in a ChatGPT or Claude export (every .zip part Claude sends, or the conversations.json) or paste what Gemini, Meta AI or any other assistant knows about you, using the prompt provided. Polychat reads only your side of the conversations in the background and files what will still matter, each with the quote it came from. The export itself is not kept.
