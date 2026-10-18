---
"@ngriffin_uk/polychat-component-shell": patch
"@ngriffin_uk/polychat-component-workspaces": patch
"@ngriffin_uk/polychat-component-capabilities": patch
"@ngriffin_uk/polychat-component-ui": patch
"@ngriffin_uk/polychat-library-react": patch
"@assistant/app": patch
---

Every page now sits in the same frame.

- **Titles in the header.** Tool, skill, invitation and app pages show their name in the top bar instead of "Chat" or "Work", with the same spacing as the rest of the app.
- **One header for project teammates.** Opening a teammate inside a project no longer stacks a "Work" bar above the teammate's own header.
- **Tidier errors.** When a workspace, project or task list fails to load, or needs you to sign in, the message appears inside the page with its title rather than floating on its own.
- **Shared links.** Shared conversations and outputs show their title while loading.
