# Run a hosted browser with personal and workspace OpenAI connections

- **Change:** enable Use Computer for managed OpenAI browser tasks and the existing worker, show current activity and approvals, and keep sign-in values outside the conversation.
- **Surfaces:** web, desktop and API.
- **Prerequisites:** apply `0056_browser_sessions` before deploying. Configure a personal OpenAI key or workspace OpenAI connection with Agents API and computer-use access. No deployment or remote migration has been performed for this change.
- **Risk if wrong:** a task cannot start or recover, an approval is sent to the wrong request, or a provider session remains active after local history is deleted.

## Verify

- [ ] Confirm Use Computer is absent without an available provider, and appears for a personal or scoped workspace OpenAI key or a configured worker with premium access.
- [ ] Run `use_computer` with `provider: "hosted"` in a durable teammate context. Read the current page, navigate, and request supervised takeover. Confirm stale run attempts cannot release the active lease and the existing user controls still stop and delete the computer.
- [ ] Enable the project tool grant and teammate tool, start a read-only website task, and approve the displayed origin. Observe activity, task completion and the result returned after Continue conversation.
- [ ] Sign in through a known HTTPS destination using the masked form. Check that email, password and verification-code values remain absent from messages and tool output. Cancel an unverified sign-in request.
- [ ] Repeat with a workspace key and no personal OpenAI key. Confirm another member cannot read or approve the browser session.
- [ ] Interrupt a startup response and refresh the same card. Confirm recovery attaches the original provider session without repeating the task.
- [ ] Stop an active task and close the browser. Confirm the provider session is deleted. Close browsers before deleting history or replacing their OpenAI connection.

**Stop and report if:** credentials appear in the conversation, an unauthorised user can inspect a session, a retry repeats a consequential task, or closing leaves the provider session active.
