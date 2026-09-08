# An agent CLI runs as a compiled process against a chosen workspace

- **Change:** the desktop core spawns compiled agent programs only, a person picks the workspace directory through a grant, and process adapters cover Codex and the remaining CLI drivers with sign-in state reported honestly.
- **Surfaces:** desktop runtimes settings, desktop chat, desktop core.
- **Prerequisites:** a desktop build with at least one agent CLI installed, and a disposable directory to grant.
- **Risk if wrong:** an agent starts in the wrong working directory, or a signed-out CLI looks available and fails opaquely mid-run.
- **Commits:** `fef6f4377`, `1af4a497a`, `2b3a4b836`, `7afe82501`, `ca703d263`, `2db03b095`, `4801080e4`.

## Verify

- [ ] Send an agent message and confirm the folder picker explains why a project folder is needed; cancel it and confirm no agent process starts.

- [ ] Grant a workspace directory through the picker and confirm the agent starts in that directory. The directory grant selects the working directory; the chosen CLI permission mode controls file access.
- [ ] Run Codex and each other configured CLI adapter, and confirm output streams back rather than the run appearing to hang.
- [ ] Sign out of an agent CLI and confirm the app reports it as signed out before a run starts.
- [ ] Point the configuration at a program that is not installed and confirm the refusal names that rather than failing generically.
- [ ] Confirm nothing but a compiled program is spawned — no shell string, no interpreter invocation.

**Stop and report if:** an agent starts in a different working directory, or a signed-out or missing CLI is offered as ready, or opening the folder picker crashes the app.
