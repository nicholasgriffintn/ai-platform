# Verify Project Workbench run controls

- **Change:** The run status strip exposes runner-only pause, resume, continue and cancellation; the conversation composer steers a live run and pending approvals appear above it, all through the existing sandbox coordinator.
- **Surfaces:** Work project conversations on web, sandbox lifecycle API and sandbox worker checkpoints.
- **Prerequisites:** A coding-enabled project conversation with one active run; use a command requiring approval for the approval checks.
- **Risk if wrong:** A stale or repeated action could duplicate an instruction, resolve an approval twice or misrepresent a completed run as cancelled.
- **Commits:** None recorded.

## Verify

- [x] During a run, send an instruction from the composer and confirm the Activity timeline shows it as submitted, then received after the worker picks it up. Reload and confirm the entries remain and the composer stays in steering mode until the run ends.
- [x] Pause a running job and confirm the request appears immediately, execution stops only at a safe boundary, and Resume continues the same run. Confirm invalid controls explain why they are disabled.
- [x] Submit the same instruction request twice with the same idempotency key and confirm only one queued instruction exists. Reuse the key with different content and confirm it is rejected.
- [x] Approve or reject a pending command, then repeat the response and confirm it cannot resolve twice. Let another approval expire and confirm it cannot be resolved.
- [x] Open the same run as another project member and confirm evidence is readable but steering and approval controls remain unavailable.
- [x] Race Cancel with terminal completion, reload and confirm the terminal run outcome is authoritative. Try a stale control update and an instruction against the terminal run and confirm both conflict.

**Stop and report if:** a duplicate instruction appears, a non-runner can control the run, an expired approval resolves, execution pauses mid-command, or reload changes the final outcome.

**Automated evidence:** all three `features/sandbox-controls.spec.ts` journeys pass together. They confirm script completion is recorded before the safe-boundary pause, immediate pause-request presentation, resume of the same run, persisted and ordered submitted/received steering with shared instruction identity, editable steering after reload, instruction idempotency, terminal disabled reasons, a completion/cancellation race and conflicts for stale terminal mutations. Repeated cancellation is an acknowledged no-op that preserves its original state.

`features/sandbox-approvals.spec.ts` confirms approval, rejection, escalation and expiry of the exact setup command before execution, and rejects a conflicting or late second resolution. `features/sandbox-membership.spec.ts` confirms member review with disabled steering, resume and service controls, plus rejected direct control, instruction and approval requests while approval evidence remains readable.
