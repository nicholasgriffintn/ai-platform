# Run a hosted browser with personal and workspace OpenAI connections

- **Change:** enable Use Computer for managed OpenAI browser tasks and the existing worker, show current activity and approvals, and keep sign-in values outside the conversation.
- **Surfaces:** web, desktop and API.
- **Prerequisites:** apply `0057_browser_sessions` before deploying. Configure a personal OpenAI key or workspace OpenAI connection with Agents API and computer-use access. No deployment or remote migration has been performed for this change.
- **Risk if wrong:** a task cannot start or recover, an approval is sent to the wrong request, or a provider session remains active after local history is deleted.

## Verify

- [x] Confirm Use Computer is absent without an available provider, and appears for a personal or scoped workspace OpenAI key or a configured worker with premium access.
- [ ] Run `use_computer` with `provider: "hosted"` in a durable teammate context. Read the current page, navigate, and request supervised takeover. Confirm stale run attempts cannot release the active lease and the existing user controls still stop and delete the computer.
- [ ] Enable the project tool grant and teammate tool, start a read-only website task, and approve the displayed origin. Observe activity, task completion and the result returned after Continue conversation.
- [ ] Sign in through a known HTTPS destination using the masked form. Check that email, password and verification-code values remain absent from messages and tool output. Cancel an unverified sign-in request.
- [x] Repeat with a workspace key and no personal OpenAI key. Confirm another member cannot read or approve the browser session.
- [x] Interrupt a startup response and refresh the same card. Confirm recovery attaches the original provider session without repeating the task.
- [x] Stop an active task and close the browser. Confirm the provider session is deleted. Close browsers before deleting history or replacing their OpenAI connection.

**Stop and report if:** credentials appear in the conversation, an unauthorised user can inspect a session, a retry repeats a consequential task, or closing leaves the provider session active.

## Automated evidence — 4 October 2026

`apps/api/src/modules/computer-use/application/sessions.test.ts` and `approvals.test.ts` pass (29 tests). They apply the real `0057_browser_sessions` migration against Miniflare D1, use the real repositories, permission checker and service context, and mock only the outbound OpenAI HTTP boundary and the built-in worker binding.

Checked off on this evidence:

- Availability: a new case confirms both providers report unavailable when neither a worker binding nor an OpenAI connection exists, alongside the existing cases for a worker without an OpenAI key, a workspace key pinned to its credential source, and a non-premium account refused with 403 before any outbound call.
- Workspace authority: workspace use is offered without a personal key, platform and personal credentials are not substituted once a workspace key is removed, a workspace connection is rejected before its secrets are read when membership is absent, and another user is blocked before OpenAI is contacted.
- Startup recovery: a timed-out creation is recovered from a later provider page without repeating the browser task, and two concurrent starts of the same tool call create exactly one remote task.
- Closing: an active task is cancelled and then its provider session deleted, in that order, and local access answers 404 afterwards.

New this pass:

- `withholds every provider when neither a worker nor an OpenAI connection is available`.
- `navigates the built-in worker unattended and keeps the same fenced lease` — a `navigate` input reaches the worker under the recorded resource, handle and fence without requiring supervised takeover.
- `cancels an unverified sign-in request without sending any credential value` — exactly one provider call, carrying neither the field name nor the entered address.

Left open, and why:

- The `use_computer` hosted journey is proven for read, navigate, supervised-takeover refusal from an obsolete run attempt, and lease fencing, but stopping and deleting the teammate computer itself is only proven for the managed provider path.
- The project tool grant journey is proven only at its authority boundary (a revoked grant is refused); the displayed-origin approval, activity rendering and the result after Continue conversation are web surfaces.
- Credential handling is proven negatively — a failed submission is never replayed and its values appear in neither the error nor the stored session, and field selection and payload bounds are enforced — but a successful sign-in through a real HTTPS destination using the masked form needs an operator with a real OpenAI Agents key.
