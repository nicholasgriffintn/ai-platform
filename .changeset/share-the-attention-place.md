---
"@assistant/app": patch
"@assistant/desktop": minor
"@ngriffin_uk/polychat-component-shell": minor
---

Give the desktop window the Attention place.

Attention is the second of the three places the shared sidebar links to that the desktop answered with a 404. The page was already built entirely from shared packages, so it moves from `apps/app` into `component-shell` unchanged and both hosts render the same one.
