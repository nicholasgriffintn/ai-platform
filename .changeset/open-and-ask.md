---
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-ai-agents": minor
"@ngriffin_uk/polychat-library-skills-catalogue": minor
"@ngriffin_uk/polychat-library-client": minor
"@ngriffin_uk/polychat-library-react": minor
"@ngriffin_uk/polychat-component-content": minor
"@ngriffin_uk/polychat-component-conversation": minor
"@ngriffin_uk/polychat-component-workspaces": minor
"@ngriffin_uk/polychat-component-shell": minor
"@assistant/api": minor
"@assistant/app": minor
"@assistant/desktop": minor
---

Open any file and ask about it.

- **One viewer for every file.** Documents, sources, recordings, images and memories all open in the same viewer. The title menu holds file info, version history, share links and every conversation about the file. Files opened from a chat, a run or a task open on top of where you were.
- **Ask about this file.** The viewer has its own conversation. Polychat reads the file fresh on every turn, can revise a document as a new revision you can restore, and keeps the conversation with the file so you can pick it up later.
- **Poly knows the page you are on.** Each place has a guide Poly reads whenever you ask it something there, and a fresh Poly conversation opens with that guide and a few starters. Your first chat opens with the guide to conversations.
- **API.** Pass `conversation.subject` with `{ type, id }` when creating a response to start a conversation about a source, output or memory, and list them with `GET /conversations?subject_type=&subject_id=`. `GET /skills/guides` returns each place's guide.
