---
"@assistant/api": minor
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-library-skills-catalogue": minor
---

Short skills can now apply themselves to the messages they help with. A skill marked `activation: per-message` (or saved with "apply automatically") is considered before each turn and, when it clearly fits, its instructions are added to that turn only, without a `load_skill` call. Selection has a 1.5 second deadline and never blocks the reply.
