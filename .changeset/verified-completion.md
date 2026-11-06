---
"@assistant/api": patch
"@ngriffin_uk/polychat-component-shell": patch
"@ngriffin_uk/polychat-component-workspaces": patch
"@ngriffin_uk/polychat-library-client": patch
"@ngriffin_uk/polychat-library-prompts-catalogue": patch
"@ngriffin_uk/polychat-library-react": patch
"@ngriffin_uk/polychat-schemas": patch
"@ngriffin_uk/polychat-utility-core": patch
---

Runs now have to show their work before they count as finished. Each completed task run is checked against what it actually did, and the task shows whether the result is verified, unverified or failed its checks. A run with no evidence stays in review for a person instead of being marked done, and the council now sees a run's evidence when it reviews the work.

Generated documents, sheets, decks and Word, Excel and PowerPoint files are reopened and checked before a run can pass. Routines now show how often they finished with evidence over the last four weeks, alongside their settings.
