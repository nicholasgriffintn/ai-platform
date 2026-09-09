# Delegations use the selected provider route

- **Change:** Delegations route hosted models to the task queue, sandbox models to sandbox execution, and reject background execution of device providers; file-writing delegates request approval before a chat delegation starts.
- **Surfaces:** Chat delegation tool, Work delegation flow, hosted/sandbox/device execution, and approval state.
- **Prerequisites:** One hosted model, one configured sandbox model, one online machine model, and one file-writing agent model available to the same test account.
- **Risk if wrong:** Work could run on the wrong execution site, file-writing work could start without approval, or a machine-only model could be incorrectly sent through the Worker queue.
- **Commits:** `ebe81568b`, `970f4208e`, `8df0c6ce5`.

## Verify

- [ ] Delegate a short task to a hosted model and confirm it runs through the hosted task path and returns to the parent conversation.
- [ ] Delegate the same task to a sandbox model and confirm the run appears as a sandbox run with its sandbox delivery policy and evidence.
- [x] Delegate to a device model and confirm it reports that background device delegation is unsupported, without queuing a handoff or substituting a hosted model.
- [ ] In a normal chat, delegate a file-writing agent and confirm an approval request appears before execution; reject it and confirm no child run starts, then approve a second request and confirm it proceeds.
- [ ] Try a file-writing delegation from an already approved/unattended context and confirm it follows the documented capability policy rather than silently bypassing the approval boundary.

**Stop and report if:** a model runs on a different site from its configuration, file-writing work starts before approval, or a rejected request creates a child run.

## Database invariants

The integration test runs the real delegation repository against isolated D1 storage and the generated table migration. Concurrent insertion enforces the three-run limit, stored parentage prevents recursive delegation even with a forged depth, settled runs release capacity, and late output cannot replace cancellation. Queued execution rechecks access to its parent conversation before starting.

Database-backed audit checks cover concurrent fan-out, terminal state protection and a later child scheduling a wake after an earlier wake has settled. Runtime settlement forwards the assistant result, preserves provider failure, and applies the deadline to generation. Expiry jobs use scheduled delivery.

## Boundary and source validation — 8 September 2026

- All 2,082 API tests passed across 288 files (`/tmp/polychat-api-verification-batch.log`). Delegation routing tests identify device and machine-backed models. Reviewed run.ts refuses the machine route with an actionable unsupported-background-delegation message before sandbox or hosted dispatch, without model substitution.
