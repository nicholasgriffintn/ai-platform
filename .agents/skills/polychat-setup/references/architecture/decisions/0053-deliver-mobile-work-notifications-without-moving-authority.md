# ADR 0053: Deliver mobile Work notifications without moving authority

Status: Accepted and implemented.

People need to respond to project work away from the web client, but a notification or native screen must not become another execution runtime or carry project secrets onto a locked device. iOS also needs to recover correctly when membership, run state or an approval changes between delivery and opening.

## Decision

Register each APNs token against the signed-in user, application bundle and APNs environment. Keep tokens in API-owned storage, invalidate tokens rejected by APNs and deduplicate each notification and device delivery. Send only generic lock-screen text for input, approval, review, completion and failure; put exact workspace, project, conversation, task and run identifiers in the application payload without task copy, commands, logs, errors or credentials.

Recheck current workspace membership before sending project notifications and again through the existing resource endpoint when iOS opens one. A notification is a hint, never proof of access or current state. Revoked membership therefore reveals no project detail and cannot open the resource; a finished run, resolved or expired approval, or repeated delivery resolves to the current API state rather than replaying an old action.

Expose compact run detail from the existing nested sandbox route. Reuse its existing event, instruction and optimistic run-control endpoints for Activity, approvals, instructions, continuation and cancellation. iOS renders a compact native Activity and terminal Proof from those contracts, omits raw output and reasoning, and shows only bounded manifest file paths rather than an editable filesystem or diff workspace.

Include the current structured question or tool approval in existing project-task detail. Resolve it through the existing task answer or approval route, then let that route resume the task under its current actor policy. A notification interaction identifier focuses the expected item, but a mismatch only prompts a reload of current state; it cannot resolve an expired or replaced interaction.

Keep push registration separate from workspace membership, runner authority, connector credentials and approval policy. Registering a device grants none of them. Only the run owner may steer an existing sandbox run, project task interaction retains its own actor rules and every operation still reaches the same server-side checks used by web.

## Consequence

iOS can notify and remotely control existing Work without a mobile runtime, workbench resource or top-level route. APNs configuration and device lifecycle add operational state, but delivery remains best effort and idempotent. Generic alerts are less descriptive on the lock screen by design; authorised detail appears only after the app reloads the resource.
