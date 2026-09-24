---
"@ngriffin_uk/polychat-component-shell": patch
"@ngriffin_uk/polychat-component-conversation": patch
"@assistant/app": patch
---

Replace browser pop-ups with in-app dialogs and toasts, and stop Attention showing Chat users a Work sales page.

- Renaming a conversation in the Chat or Work sidebar opens a shared `RenameConversationDialog` instead of `window.prompt`, and rename, upload and history-export failures show a toast instead of `window.alert`.
- Attention shows everyone signed in their background tasks. Workspace attention and the task inbox stay Pro-only, and non-Pro users see a short note pointing at Work instead of the full `WorkAccessEmptyState` panel.
- The Workspaces page no longer repeats the notification inbox that Attention already shows; it shows an unread count linking to Attention.
