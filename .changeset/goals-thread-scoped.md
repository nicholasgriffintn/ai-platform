---
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-library-chat": minor
"@ngriffin_uk/polychat-component-conversation": minor
---

Add thread-scoped goals. A goal is a completion contract owned by a conversation or a sandbox run: it shapes the system prompt, survives turns, and only completes against an evidence ledger. Termination is behavioural — completed, blocked, stalled, or limit reached — with no iteration cap.
