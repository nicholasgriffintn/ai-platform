# Verify project environment setup

- **Change:** Project coding environments can run versioned full setup or lightweight resume configuration before agent work.
- **Surfaces:** Work project settings, sandbox Activity and Proof.
- **Prerequisites:** A disposable coding project; for repository configuration, commit `.polychat/environment.json` with `version: 1` and at least one `setupCommands` entry.
- **Risk if wrong:** A run could use stale setup, execute unreviewed repository instructions, leak a credential or hide setup failure as an agent failure.
- **Commits:** None recorded.

## Verify

- [ ] Configure Polychat setup with one runtime, package manager, setup command, resume command and timeout. Save, reload and confirm the exact editable values return; select **No setup commands** and confirm the setup is removed without disconnecting the repository.
- [ ] Run the project and confirm Activity shows configuration resolution, setup commands, bounded output and a completed terminal setup state before planning begins. Confirm Proof shows the Polychat configuration revision, requirements, setup mode and duration.
- [ ] Edit the project setup after the run is queued and confirm the existing run retains its queued configuration while a later run uses a different revision.
- [ ] Select repository configuration and confirm the run reads only `.polychat/environment.json` from the cloned revision. Change that file in a later commit and confirm Proof reports a different blob revision.
- [ ] Request resume with configured resume commands and confirm only the lightweight commands run. Remove the resume commands, request resume again and confirm it falls back to full setup and records **setup** as the effective mode.
- [ ] Use an unavailable runtime, a mismatched version, malformed JSON, an oversized repository definition, a failing command and an expired timeout. Confirm each fails before agent work with a useful terminal error and retained configuration evidence where a valid revision was resolved.
- [ ] Add a network setup command under a policy that requires approval and confirm it waits for the existing exact command approval. Reject it and confirm the command does not execute.
- [ ] Try to save a recognisable inline token or secret assignment and confirm validation refuses it. Produce secret-shaped command output and confirm persisted Activity and logs contain redaction rather than the value.

**Stop and report if:** repository configuration bypasses command policy, a changed project definition rewrites an existing run, an inline credential persists, setup continues after timeout or failure, or Proof cannot identify the valid configuration revision used.
