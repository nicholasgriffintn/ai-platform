---
"@assistant/api": minor
"@ngriffin_uk/polychat-library-tools": minor
"@ngriffin_uk/polychat-library-skills-catalogue": patch
"@ngriffin_uk/polychat-utility-core": minor
"@ngriffin_uk/polychat-component-content": patch
---

The assistant now checks HTML and SVG artifacts before showing them. It renders the draft once in an isolated browser under the same sandbox rules as the artifact viewer, sees desktop and mobile screenshots with any console errors, page errors, blocked requests or sideways scrolling, and fixes what it finds before presenting the artifact. Previews are limited to three per response and never load web addresses.
