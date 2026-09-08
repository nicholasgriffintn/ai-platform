# A teammate can run a Replicate model

- **Change:** Adds a `run_prediction` tool so a conversation can run a model from Replicate's catalogue and keep the result in Files, instead of the app being the only way in. It runs on the caller's own Replicate key and refuses when they have not configured one, which is stricter than the app's own path, where a Pro plan is enough. An unknown model id is refused with real ids to try. In a project it checks that Replicate is enabled there and that the caller is a member.
- **Surfaces:** API only. No schema change and no migration.
- **Prerequisites:** A Replicate key configured in provider settings.
- **Risk if wrong:** A prediction running against someone else's key, or a project result written by a non-member.

## Verify

- [x] With no Replicate key configured, ask a conversation to run a Replicate model. Confirm it refuses and says to add a key, and that nothing is charged.
- [ ] Add a key and ask again. Confirm the prediction runs, the result appears in Files, and long runs report progress like any other background work.
- [x] Ask for a model that does not exist. Confirm the refusal names real models rather than inventing one.
- [ ] Run it inside a project with Replicate enabled. Confirm the result lands in the project's Files.
- [x] Run it inside a project where Replicate is not enabled. Confirm it is refused.
- [x] As a non-member of that project, confirm the tool is refused.
- [x] Confirm the key used is the caller's own, not the project owner's.

**Stop and report if:** a prediction runs without the caller's own key, or a result is written into a project the caller cannot access.

## Additional automated service evidence — 8 September 2026

- `run_prediction.test.ts` confirms missing caller credentials reject before the executor is called, and an unknown model rejects with a catalogue model ID rather than running. These validate tool-level refusal; successful provider execution and project persistence remain open.
- These tests passed in the existing 66-test service batch; no additional run was started.

## Reviewed boundary evidence — 8 September 2026

- Source audit traced run_prediction through requireOptionalProjectCapabilityAccess, current workspace membership, enabled app grants and the Replicate executor/provider. The caller is passed unchanged to credential lookup; no project-owner lookup occurs. Existing access tests cover disabled grants and revoked membership, and the recorded tool tests cover the pre-execution credential gate. These are automatic boundary/source checks; successful provider output and Files journeys remain open.
