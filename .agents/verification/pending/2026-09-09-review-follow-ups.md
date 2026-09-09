# Sandbox inspection windows can be cancelled and desktop agent sessions stop on quit

- **Change:** a completed sandbox run held for inspection now accepts the cancel control, which settles the run and revokes preview sessions. The desktop app stops every live Codex session when it exits, and restarts a session whose process died instead of adopting the dead handle. Delegations revoke their parent conversation handle when they settle.
- **Surfaces:** API sandbox run controls, sandbox Worker, desktop app, chat delegations.
- **Prerequisites:** none.
- **Risk if wrong:** a cancelled inspection window leaves the sandbox and previews alive until it expires, orphaned `codex app-server` processes survive quitting the desktop app, or a settled delegate keeps posting into its parent conversation.
- **Commits:** 6748aaee6, e5afa8d64, 8983d7770.

## Verify

- [ ] Run a sandbox task with an inspection window, then send `cancel` from the run controls while the window is open; the run reports cancelled and the preview URL stops responding.
- [ ] Start a Codex session from the desktop app, quit the app, and confirm no `codex app-server` process remains.
- [ ] Kill a running `codex app-server` process by hand, then send another turn in the same conversation; a new process starts and the turn completes.
- [ ] Let a delegate finish, then trigger it to message its parent; the parent conversation receives nothing and the call is refused.

**Stop and report if:** a cancelled inspection window still serves previews, a Codex process outlives the app, or a settled delegate can still write into its parent.
