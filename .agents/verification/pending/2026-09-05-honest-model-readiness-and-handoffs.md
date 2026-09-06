# Honest model readiness and handoffs

- **Change:** Model and capability readiness now expires, distinguishes unknown checks from known blockers, and explains model handoff consequences without automatic substitution.
- **Surfaces:** API, web Chat and Work, native iPhone.
- **Prerequisites:** Use test provider accounts and mocked capability-source failures. No migration or new binding is required.
- **Risk if wrong:** Users may send with revoked access, lose attachments or context, strand an interaction, or unknowingly run a different model.
- **Commits:** Uncommitted goal work.

## Verify

- [ ] Select a BYOK-only model on web and iPhone, remove its provider key, then refresh or reopen the client. Confirm the same model remains selected, its credential or access reason is visible, sending is disabled, and no replacement model runs.
- [ ] Restore the key, reverse the selection to another model, and confirm readiness refreshes and the next run uses only the explicitly selected model. Remove project membership and confirm a project-scoped capability or run is still rejected by the server.
- [ ] Let a ready model snapshot pass its one-minute expiry. Confirm web refreshes before submission and blocks on refresh failure; confirm iPhone asks for a model-list refresh rather than treating the expired result as authority.
- [ ] Force capability-source loading to fail and confirm discovery reports **Unknown** with a retry instruction. Separately deny a tool through current policy and confirm it reports **Unavailable**, not Unknown.
- [ ] While a run is generating and while it awaits an approval or question, try to change models on both clients. Confirm the control is blocked and the pending interaction remains attached to its original run.
- [ ] Attach an image, audio file and document, then try models lacking each input capability. Confirm the change is rejected with the incompatible type and succeeds after removing it or choosing a compatible model.
- [ ] In a conversation with history, select a one-turn image generator. Confirm both clients require a new conversation and state that history does not carry across.
- [ ] Change between compatible chat models after a completed turn. Confirm stored history and compatible attachments remain, model-specific processing settings reset, and only the next run uses the new model.
- [ ] Request a branch and an in-place second opinion. Confirm alternatives retain separate response/model attribution, run identity and usage records rather than relabelling the original result.

**Stop and report if:** a stale preflight permits a server-rejected action, any client silently changes the selected model, or a pending interaction can be continued under a different run/model identity.
