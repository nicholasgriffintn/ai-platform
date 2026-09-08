# Branches become threads

- **Change:** The branch concept is presented and named as a thread throughout: the button, the message action, the toasts, the contracts, the library module and the API route, which moves from `/chat/completions/:id/branches` to `/chat/completions/:id/threads`. The underlying parent-conversation mechanism is unchanged, and so is who can see what.
- **Surfaces:** Web app and API. iOS does not use this route.
- **Prerequisites:** None. No schema change.
- **Risk if wrong:** A thread family that no longer loads, a reply that can no longer start a thread, or a caller of the old route breaking silently.
- **Commits:** This branch.

## Verify

- [x] Open a saved conversation with related conversations. Confirm the header offers Threads, that it lists the family with the current one marked, and that selecting one opens it.
- [x] Start a thread from an assistant reply and from a user message. Confirm both appear in the family and the new conversation answers.
- [x] Confirm a local-only conversation and a shared read-only view still do not offer Threads.
- [x] As a person outside a project, confirm the thread family for a project conversation is still refused.
- [x] Confirm `/chat/completions/:id/branches` returns 404 and `/threads` returns the family. The old path is gone, not aliased.

**Stop and report if:** a thread family shows a conversation the viewer could not previously see, or starting a thread copies history rather than linking it.

## Automated evidence — 7 September 2026

- `features/chat.spec.ts` starts a thread from an assistant reply and from a user message, confirms both join the family through `/chat/completions/:id/threads`, and that the new conversation answers.
- It opens the Threads control from the sibling, the child and the parent in turn, confirms the current and archived marks, that selecting a thread opens it, and that the control survives a reload.
- It confirms `/chat/completions/:id/branches` answers 404 while `/threads` returns the family, and that a signed-in outsider is refused the family of a personal conversation.
- Fix: the header only offered Threads on the conversation that was branched from, and only until the page reloaded, because `has_branches` was set optimistically on the parent and never returned by the API. The conversation response now reports family membership, and a stored thread carries it too.
- Left open: local-only and shared read-only conversations, and a project conversation's family refused to a non-member.

## Automated evidence — 8 September 2026, container b2276b14

- `features/saved-messages.spec.ts` confirms no Threads action in the shared read-only view; the previously passing temporary Chat journey in container `1e9e88ba` confirms the local-only case. `features/work.spec.ts` confirms an outsider receives 404 for a project conversation thread family.
- The targeted batch recorded 14 passing journeys and one failing composer assertion. Only the passing journeys support these check-offs.
