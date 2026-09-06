# Branches become threads

- **Change:** The branch concept is presented and named as a thread throughout: the button, the message action, the toasts, the contracts, the library module and the API route, which moves from `/chat/completions/:id/branches` to `/chat/completions/:id/threads`. The underlying parent-conversation mechanism is unchanged, and so is who can see what.
- **Surfaces:** Web app and API. iOS does not use this route.
- **Prerequisites:** None. No schema change.
- **Risk if wrong:** A thread family that no longer loads, a reply that can no longer start a thread, or a caller of the old route breaking silently.
- **Commits:** This branch.

## Verify

- [ ] Open a saved conversation with related conversations. Confirm the header offers Threads, that it lists the family with the current one marked, and that selecting one opens it.
- [ ] Start a thread from an assistant reply and from a user message. Confirm both appear in the family and the new conversation answers.
- [ ] Confirm a local-only conversation and a shared read-only view still do not offer Threads.
- [ ] As a person outside a project, confirm the thread family for a project conversation is still refused.
- [ ] Confirm `/chat/completions/:id/branches` returns 404 and `/threads` returns the family. The old path is gone, not aliased.

**Stop and report if:** a thread family shows a conversation the viewer could not previously see, or starting a thread copies history rather than linking it.
