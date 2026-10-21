---
"@ngriffin_uk/polychat-schemas": minor
"@assistant/api": minor
---

Skill drafts are now replayed before they can be promoted. Poly re-runs up to three recent requests that used the skill with the draft in charge, simulates anything that would send, spend or delete, and compares the new answers with the originals. Skills Poly drafts from a run are replayed against that run straight away. A draft that made any request worse is held back until you revise it or choose to promote it anyway.
