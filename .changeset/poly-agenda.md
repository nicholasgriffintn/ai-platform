---
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-ai-prompts": minor
"@ngriffin_uk/polychat-library-prompts-catalogue": minor
"@ngriffin_uk/polychat-library-client": minor
"@ngriffin_uk/polychat-library-react": minor
"@ngriffin_uk/polychat-component-shell": minor
"@assistant/api": minor
---

Give Poly an agenda. `GET /poly/agenda` derives what needs the person, what Poly is working on and what it finished this week from the Poly thread's delegations, goal and latest run, with no new storage. Poly's prompt carries the agenda each turn, the overlay shows it above the thread, and the sidebar's Ask Poly button shows Poly's status. The agenda refreshes on the live delegation, goal and run events for the Poly thread.
