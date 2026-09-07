# Files works the same in the desktop window and on the web

- **Change:** `FilesPage` and its Made, Given and Memory libraries moved into `component-shell`, and the desktop window serves them at `/chat/files`.
- **Surfaces:** web, desktop.
- **Prerequisites:** none.
- **Risk if wrong:** Files stops loading, saving or sharing on the web, or the desktop sidebar keeps leading to a 404.
- **Commits:** this change.

## Verify

- [ ] On the web, open Files from the chat sidebar and confirm Made, Given and Memory each list their contents and switch by tab.
- [ ] Add a source, then delete it, and confirm both the list and the API agree.
- [ ] Open an output, edit a document revision and restore an earlier one.
- [ ] Create a share link for an output and then revoke it.
- [ ] Open a project's Files inside Work and confirm it still scopes to that project.
- [ ] In the desktop window, open Files from the sidebar and repeat the list, add and delete checks.
- [ ] Sign out on the web and confirm the Files empty state opens the login modal; do the same in the desktop window and confirm it opens browser sign-in instead.

**Stop and report if:** an output's share link cannot be created or revoked, or a memory document saves under the wrong scope.
