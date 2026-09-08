# A conversation carries the permission mode its agent runs under

- **Change:** four permission modes stored on the conversation, defaulting to auto-accept edits, inherited by a branch, with unavailable modes shown as unavailable and refused rather than substituted.
- **Surfaces:** web composer settings, API conversation persistence and chat completion request.
- **Prerequisites:** migration `0046_closed_slayback` adds the conversation column.
- **Risk if wrong:** a conversation runs under looser permissions than the control displays, or a branch loosens its parent's setting.
- **Commits:** 9cc5a49a2.

## Verify

- [ ] Select an agent provider and confirm the Agent permissions control appears in composer settings; select an ordinary model and confirm it is absent.
- [ ] Start a new conversation and confirm it opens on Auto-accept edits.
- [ ] Set Supervised, branch the conversation, and confirm the branch opens on Supervised rather than the default.
- [ ] With a provider that does not report its own review, confirm Auto reads as unavailable and the reason appears under the control.
- [ ] Select an unavailable mode and confirm the setting does not change.
- [ ] Change mode mid-conversation and confirm earlier turns are unaffected and the next run uses the new mode.
- [ ] Confirm approvals still arrive inline in the thread and resolve there.

**Stop and report if:** a run proceeds under a mode other than the one displayed, a branch resets to the default, or the control appears for a provider that neither writes files nor runs commands.
