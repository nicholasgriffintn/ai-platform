# Codex runs as a resumable session a conversation owns

- **Change:** the desktop core keeps a long-lived Codex `app-server` per conversation with both pipes open, the conversation remembers its folder and native thread, approvals can be answered from Polychat, and every driver reports the capabilities it actually has.
- **Surfaces:** desktop chat, desktop runtimes settings, desktop core, shared permission-mode selector.
- **Prerequisites:** a desktop build, `codex` installed and signed in, and a disposable git repository to grant.
- **Risk if wrong:** a conversation silently loses its thread and starts cold, an approval cannot be answered and the turn stalls, or a permission mode is offered that the driver cannot honour.

## Verify

- [ ] Send a first message to Codex, grant a folder, and confirm the run starts in that folder.
- [ ] Send a second message in the same conversation and confirm no folder picker appears and the agent remembers the first message.
- [ ] Quit and reopen the application, send a third message in that conversation, and confirm it still resumes rather than starting a new thread.
- [ ] Choose Supervised, ask for something that needs a command, and confirm an approval appears in Polychat with the command shown. Allow it and confirm the turn continues; decline one and confirm the agent is told.
- [ ] Confirm Auto and Auto-accept edits behave differently: Auto should not ask, because the agent reviews its own approvals.
- [ ] With an approval waiting, switch to another conversation and confirm the request does not follow you, then switch back and answer it there.
- [ ] Leave an approval unanswered and stop the turn; confirm the request clears rather than lingering above the composer.
- [ ] Revoke the folder grant in runtimes settings, return to that conversation, send a message, and confirm it asks for a folder again rather than failing.
- [ ] Open a second conversation on the same folder and confirm both can run without one interrupting the other.
- [ ] Stop `codex` mid-run (kill the process) and confirm the turn reports that the agent stopped rather than hanging.
- [ ] Check a driver with no session support — Claude Code, Cursor, Grok or OpenCode — still runs on the batch path, and that Supervised is not offered for it.
- [ ] Point the Codex binary path at something that is not installed and confirm the refusal names that.

**Stop and report if:** an approval cannot be answered from Polychat, a conversation resumes someone else's thread, an agent starts in a folder that was never granted, or a permission mode is offered that the run then refuses.
