# A finished sandbox run can be inspected before its environment goes

- **Change:** validation checks carry bounded redacted output, the initiating runner can send a one-shot `run_command` to a live sandbox, and a project may hold its environment open for a bounded window after terminal status, extendable once.
- **Surfaces:** web Work project settings and the run workbench Activity pane, API sandbox run instruction and control endpoints, sandbox worker.
- **Prerequisites:** migration `0045_nebulous_nighthawk` adds the project inspection window column. The window is off by default; set it per project before testing.
- **Risk if wrong:** a held environment keeps costing container time, a runner command runs outside the command policy, or a non-runner steers someone else's run.
- **Commits:** 3e17ca9b5, dfc49d019, abd2c5f48.

## Verify

- [ ] Run a project task whose validation fails, then open Activity and expand the failed check to read its output.
- [ ] Confirm setup commands, service transitions, agent commands, validation and runner commands appear in one ordered list, each expandable.
- [ ] With the window set above zero, send a runner command after the run reports completed and read its output in Activity.
- [ ] Send `NPM_TOKEN=abc pnpm install` as a runner command and confirm it is refused with the same reason an agent command gets.
- [ ] Send `pnpm dev &` and confirm the backgrounding attempt is refused rather than detached.
- [ ] Extend the window once and confirm the expiry moves; attempt a second extension and confirm it is refused.
- [ ] Wait for the window to close, then send a runner command and confirm the reply names the closed window instead of hanging.
- [ ] Open a preview during the run, then confirm it stops working once the window closes.
- [ ] As a different project member with access to the run, attempt a runner command and confirm it is refused.
- [ ] Check the run's usage report accounts for the held time.
- [ ] Read the persisted run record and client responses for any process id, container address or Sandbox SDK URL.

**Stop and report if:** a runner command succeeds for anyone but the initiating runner, a command bypasses the policy, a preview keeps working after the window closes, or an environment stays held past its expiry.

Automated inspection checks confirm an expired window refuses remaining queued commands and passes the remaining deadline to the sandbox command API. Stream checks cover credentials split across SDK output events before output reaches the client.
