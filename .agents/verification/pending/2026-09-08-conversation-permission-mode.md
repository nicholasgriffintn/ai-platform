# A conversation carries the permission mode its agent runs under

- **Change:** four permission modes stored on the conversation, defaulting to auto-accept edits, inherited by a branch, with unavailable modes shown as unavailable and refused rather than substituted.
- **Surfaces:** web composer settings, API conversation persistence and chat completion request.
- **Prerequisites:** migration `0046_closed_slayback` adds the conversation column.
- **Risk if wrong:** a conversation runs under looser permissions than the control displays, or a branch loosens its parent's setting.
- **Commits:** 9cc5a49a2.

## Verify

- [ ] Select an agent provider and confirm the Agent permissions control appears in composer settings; select an ordinary model and confirm it is absent.
- [x] Start a new conversation and confirm it opens on Auto-accept edits.
- [x] Set Supervised, branch the conversation, and confirm the branch opens on Supervised rather than the default.
- [ ] With a provider that does not report its own review, confirm Auto reads as unavailable and the reason appears under the control.
- [ ] Select an unavailable mode and confirm the setting does not change.
- [ ] Change mode mid-conversation and confirm earlier turns are unaffected and the next run uses the new mode.
- [x] Send a turn from a client that omits the mode and confirm the run uses the conversation's stored mode rather than the default.
- [ ] Confirm approvals still arrive inline in the thread and resolve there.

**Stop and report if:** a run proceeds under a mode other than the one displayed, a branch resets to the default, or the control appears for a provider that neither writes files nor runs commands.

## Boundary and source validation — 8 September 2026

- All 2,082 API tests passed across 288 files (`/tmp/polychat-api-verification-batch.log`). conversationManager-permission-mode.test.ts verifies a new thread inherits supervised from its parent, while an explicit mode wins. The stored field supplies the client conversation setting; this is persistence-boundary evidence.

## Stored/default mode boundary — 9 September 2026

- The previously passing schema suite verifies omitted request mode inherits Supervised, explicit mode wins, and absent/invalid stored mode defaults to Auto-accept edits. The conversation-manager test preserves the database default for new conversations; migration 0046 declares that same default. Reviewed RequestPreparer loads the stored conversation mode, resolves it before execution, rejects unsupported modes, and ChatOrchestrator forwards the prepared mode. Picker interactions remain pending.
