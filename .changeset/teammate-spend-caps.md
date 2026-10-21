---
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-ai-billing": minor
"@ngriffin_uk/polychat-library-client": minor
"@ngriffin_uk/polychat-library-react": minor
"@ngriffin_uk/polychat-component-shell": minor
"@assistant/api": minor
---

Teammates and routines now show what they cost and can be given a monthly budget.

- **Spend on the teammate page.** A teammate's card shows the credits its runs have used this month, and the working context has a Spend section with the same figure against its cap.
- **Monthly caps.** Set a cap in credits on a teammate's working context or on a routine. Once the month's spend reaches it, new runs are refused with a note saying why, a routine over its cap pauses itself with the reason shown, and everything resumes when the month resets or you raise the cap.
- **Runs remember their routine.** Each run records which routine started it, so routine spend is exact rather than estimated.
