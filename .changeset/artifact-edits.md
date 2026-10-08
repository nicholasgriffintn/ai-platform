---
"@ngriffin_uk/polychat-library-chat": minor
"@ngriffin_uk/polychat-library-skills-catalogue": minor
"@ngriffin_uk/polychat-component-content": patch
"@ngriffin_uk/polychat-component-conversation": minor
"@assistant/api": minor
---

Let the model edit a large artifact without rewriting it. An artifact tagged `mode="edit"` carries FIND/REPLACE blocks, and the API applies them to the latest version of that artifact when the turn finishes, storing and sending the full updated artifact. Each FIND must match exactly once. While a reply streams the thread shows that the artifact is updating, and an edit that cannot be applied is reported rather than rendered.
