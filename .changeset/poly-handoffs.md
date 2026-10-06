---
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-ai-prompts": minor
"@ngriffin_uk/polychat-library-prompts-catalogue": minor
"@ngriffin_uk/polychat-component-shell": minor
"@assistant/api": minor
---

Budget Poly's interruptions. Routines Poly sets up from its thread now report back to it, and each routine result passes through a judged, budgeted handoff before it reaches the person: results waiting on them always interrupt, failures and results a decision policy rates as urgent interrupt within five a day and thirty minutes apart, and everything else is noted quietly. Each occurrence is decided once and recorded as a `poly.handoffs` activity on the Poly thread, and the agenda, Poly's prompt and the overlay list what was noted and why.
