---
"@assistant/api": patch
"@ngriffin_uk/polychat-component-shell": patch
"@ngriffin_uk/polychat-library-chat": minor
"@ngriffin_uk/polychat-schemas": minor
---

Fewer needless approval prompts, and Discover chats that survive a reload.

- **Reads and drafts no longer ask.** Reading a page you linked, saving a note or anything else that stays in your own space now just runs. The second check on whether a call matches what you asked is kept for calls that change shared state, send, spend or delete.
- **Discover chats stay with their item.** Each item in For you or Reading keeps its own conversation, so reloading, switching items or opening it on your phone brings the chat back, and Poly sees the item you asked about rather than the whole edition.
