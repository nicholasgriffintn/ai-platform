# Verify Project Workbench run controls

- **Change:** The run status strip now exposes runner-only steering, pause, resume, cancellation and pending approvals through the existing sandbox coordinator.
- **Surfaces:** Work project conversations on web, sandbox lifecycle API and sandbox worker checkpoints.
- **Prerequisites:** A coding-enabled project conversation with one active run; use a command requiring approval for the approval checks.
- **Risk if wrong:** A stale or repeated action could duplicate an instruction, resolve an approval twice or misrepresent a completed run as cancelled.
- **Commits:** None recorded.

## Verify

- [ ] During a run, add an instruction and confirm its presentation moves from submitted or accepted to queued, then processed after the worker receives it. Reload and confirm the instruction and matching Activity entries remain.
- [ ] Pause a running job and confirm the request appears immediately, execution stops only at a safe boundary, and Resume continues the same run. Confirm invalid controls explain why they are disabled.
- [x] Submit the same instruction request twice with the same idempotency key and confirm only one queued instruction exists. Reuse the key with different content and confirm it is rejected.
- [ ] Approve or reject a pending command, then repeat the response and confirm it cannot resolve twice. Let another approval expire and confirm it cannot be resolved.
- [ ] Open the same run as another project member and confirm evidence is readable but steering and approval controls remain unavailable.
- [ ] Race Cancel with terminal completion, reload and confirm the terminal run outcome is authoritative. Try a stale control update and an instruction against the terminal run and confirm both conflict.

**Stop and report if:** a duplicate instruction appears, a non-runner can control the run, an expired approval resolves, execution pauses mid-command, or reload changes the final outcome.

**Automated evidence:** `features/sandbox-controls.spec.ts` confirms pause at a checkpoint, resume of the same run, persisted steering, instruction idempotency and conflicts for terminal mutations. Repeated cancellation is an acknowledged no-op that preserves its original state. Leave combined checks open until every listed presentation or race outcome is covered.

`features/sandbox-approvals.spec.ts` confirms approval and rejection of the exact setup command before execution and rejects a conflicting second resolution. `features/sandbox-membership.spec.ts` confirms member review with disabled steering, resume and service controls, plus rejected direct control and instruction requests. Approval expiry and member approval controls still need coverage.
