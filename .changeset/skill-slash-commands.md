---
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-library-skills-catalogue": minor
"@ngriffin_uk/polychat-library-chat": minor
"@ngriffin_uk/polychat-library-react": patch
"@ngriffin_uk/polychat-component-conversation": minor
"@ngriffin_uk/polychat-component-shell": minor
"@assistant/api": minor
---

Skills now work as slash commands. Type `/` in the composer to see your skills alongside the usual commands, and pick one to apply its full instructions to that message, whether or not the assistant would have chosen it. Search ranks exact names first, then names that start with or contain what you typed, then descriptions.

Skills can also say who may start them. Turn off **Slash command** to keep a skill out of the composer, or turn on **Only when invoked** so the assistant never picks it by itself, which suits workflows with side effects. Both switches sit under the skill document in the editor, and `SKILL.md` files can set them with the `user-invocable` and `disable-model-invocation` frontmatter fields. When saving a skill from a conversation, the assistant can set them too.
