# Verify hosted browser and computer use

- **Change:** Use Computer supports managed OpenAI browser sessions and the hosted computer worker.
- **Surfaces:** web, desktop, API and computer worker.
- **Prerequisites:** an OpenAI connection with Agents API computer-use access, or a premium account with `COMPUTER_WORKER` configured.
- **Risk if wrong:** credentials or browser activity may cross user or project boundaries, or a provider session may remain active after the local task ends.

## Verify

- [ ] In a durable teammate context, start a hosted computer task, read and navigate a page, then verify stop and delete. Confirm a stale run cannot release the active lease.
- [ ] In a project conversation, enable the tool grant, start a read-only website task and check the origin approval, activity and result after **Continue conversation**. Confirm another member cannot inspect or approve the session.
- [ ] With an OpenAI Agents API test account, sign in to a verified HTTPS destination using the masked form. Confirm values stay out of messages and tool output; cancel an unverified request.

**Stop and report if:** a credential appears in conversation or tool output, another user can inspect or approve a session, a retry repeats a consequential task, or closing leaves the provider session active.
