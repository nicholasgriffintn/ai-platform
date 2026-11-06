---
"@assistant/api": patch
"@ngriffin_uk/polychat-ai-billing": patch
"@ngriffin_uk/polychat-component-conversation": patch
"@ngriffin_uk/polychat-component-shell": patch
"@ngriffin_uk/polychat-library-chat": patch
"@ngriffin_uk/polychat-library-client": patch
"@ngriffin_uk/polychat-library-policy": patch
"@ngriffin_uk/polychat-schemas": patch
---

Runs can now stop at a limit you set, and a run that fails on our side costs nothing.

- Set **Run credit cap** in chat settings, or send `budget.credits` to the Responses API. The run stops before it could go over, and you are never charged more than the cap.
- A run that fails on our side costs nothing. Credits it used are returned automatically and shown on the run.
