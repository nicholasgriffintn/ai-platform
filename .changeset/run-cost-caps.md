---
"@assistant/api": patch
"@ngriffin_uk/polychat-ai-billing": patch
"@ngriffin_uk/polychat-component-content": patch
"@ngriffin_uk/polychat-component-conversation": patch
"@ngriffin_uk/polychat-component-shell": patch
"@ngriffin_uk/polychat-library-chat": patch
"@ngriffin_uk/polychat-library-client": patch
"@ngriffin_uk/polychat-library-policy": patch
"@ngriffin_uk/polychat-library-react": patch
"@ngriffin_uk/polychat-schemas": patch
---

Runs now show their likely cost before they start and can stop at a limit you set.

- Set **Run credit cap** in chat settings, or send `budget.credits` to the Responses API. The run pauses and asks you before it could go over, and you can raise the cap or stop there. You are never charged more than the cap.
- See credits used so far while a run is working, and a likely cost and upper limit before you send. `POST /responses/estimate` returns the same figures.
- A run that fails on our side now costs nothing. Credits it used are returned automatically and shown on the run.
