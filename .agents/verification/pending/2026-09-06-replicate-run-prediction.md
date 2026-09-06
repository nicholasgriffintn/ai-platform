# A teammate can run a Replicate model

- **Change:** Adds a `run_prediction` tool so a conversation can run a model from Replicate's catalogue and keep the result in Files, instead of the app being the only way in. It runs on the caller's own Replicate key and refuses when they have not configured one, which is stricter than the app's own path, where a Pro plan is enough. An unknown model id is refused with real ids to try. In a project it checks that Replicate is enabled there and that the caller is a member.
- **Surfaces:** API only. No schema change and no migration.
- **Prerequisites:** A Replicate key configured in provider settings.
- **Risk if wrong:** A prediction running against someone else's key, or a project result written by a non-member.

## Verify

- [ ] With no Replicate key configured, ask a conversation to run a Replicate model. Confirm it refuses and says to add a key, and that nothing is charged.
- [ ] Add a key and ask again. Confirm the prediction runs, the result appears in Files, and long runs report progress like any other background work.
- [ ] Ask for a model that does not exist. Confirm the refusal names real models rather than inventing one.
- [ ] Run it inside a project with Replicate enabled. Confirm the result lands in the project's Files.
- [ ] Run it inside a project where Replicate is not enabled. Confirm it is refused.
- [ ] As a non-member of that project, confirm the tool is refused.
- [ ] Confirm the key used is the caller's own, not the project owner's.

**Stop and report if:** a prediction runs without the caller's own key, or a result is written into a project the caller cannot access.
