# @ngriffin_uk/polychat-library-interactions

Human interaction primitives: approval request records, the loop that waits for a decision, and the SLA rules that escalate then time out a pending request. Hosts own storage and delivery; this package owns the waiting mechanics and the policy, so a worker polling an approval and an API lazily transitioning one apply the same rules.

```ts
import { evaluateApprovalSla, resolveApproval } from "@ngriffin_uk/polychat-library-interactions";

const result = await resolveApproval({
  subject: "deploy v2",
  riskLevel: "network",
  trustLevel: "balanced",
  reason: "network command",
  agentStep: 3,
  emit: (event) => emitRunEvent(event),
  guardExecution: (message) => checkpoint(message),
  shouldRequireApproval: ({ riskLevel, trustLevel }) => requiresApproval(riskLevel, trustLevel),
  approvalWindowForRiskLevel: (riskLevel) => windows[riskLevel],
  approvalClient: runControlClient,
  eventPrefix: "command_approval",
});

if (!result.rejected) {
  await run();
}
```

## Waiting

`resolveApproval` calls `shouldRequireApproval`; when it is false the call resolves approved without contacting the client. Otherwise it requests an approval, emits `{prefix}_requested`, then polls `fetchApproval` every two seconds, emitting `{prefix}_escalated` once and `{prefix}_resolved` or `{prefix}_timed_out` at the end. `fetchControlState` is optional; a `cancelled` state or a failing `guardExecution` stops the wait with an `InteractionError`.

## SLA

`evaluateApprovalSla({ status, escalationAt, expiresAt }, now)` is pure. It returns `null` while the request is inside its SLA, an `escalated` transition once `escalationAt` passes, and a `timed_out` transition once `expiresAt` passes. Timeout wins when both are due in one pass, and an already-escalated request is never re-escalated. The caller persists the returned fields, keeping existing values where it already set them.

## Envelope

The `humanInTheLoop` wire envelope is described by `humanInTheLoopSchema` in `@ngriffin_uk/polychat-schemas`; this package owns its writers. `pendingApproval`, `pendingQuestion`, `pendingSelection` and `pendingTakeover` produce the pending forms, and `mergeHumanInTheLoop(previous, patch)` preserves unknown fields while applying a status or resolution change. `resolveHumanInTheLoop` and `expireHumanInTheLoop` are the two terminal presets used by project-task resolution and interaction recovery.
