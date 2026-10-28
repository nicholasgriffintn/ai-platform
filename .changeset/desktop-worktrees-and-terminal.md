---
"@assistant/api": patch
"@assistant/desktop": patch
---

In a git folder, each desktop conversation now works on its own branch in a separate worktree, so your checkout stays as it was. Every turn shows the files it changed, and the conversation's Changes pane shows the whole branch with Commit and Open pull request; the pull request is built on GitHub through your GitHub connection. A Terminal pane opens a shell in the same folder and keeps its history when you come back.
