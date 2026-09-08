# Chat with a model running on another device

- **Change:** Web and iOS send text turns through the authenticated desktop relay and display the returned reply. Remove the unconsumed handoff queue and its placeholder replies.
- **Surfaces:** Web and iOS chat, desktop discovery and execution, API machine routes.
- **Prerequisites:** Configure `MACHINE_RUN_COORDINATOR` and its Durable Object migration from the API example configuration. Database migration `0049_melted_freak` removes the unused handoff queue; it has not been applied to an existing database by this audit.
- **Risk if wrong:** A model appears selectable but cannot reply, output is lost on reload, or another account can access the run.

## Verify

- [ ] Open desktop with an Ollama model connected; select that desktop model in web and iOS, send a text message, and read the reply on the requesting device.
- [x] Reload the conversation and confirm the model selection and reply remain.
- [x] Stop a running response and confirm late output does not restart it.
- [ ] Close or disconnect the desktop during a response and confirm the requester receives an actionable failure.

**Automated evidence:** The isolated web E2E journey covers selection, reply completion, reload, account ownership and cancellation with only the outbound Ollama service mocked. The iOS suite covers the advertised model contract and incremental relay output.

**Stop and report if:** a disconnected runtime looks executable indefinitely, a cancelled run resumes, or a request reads another account's output.

## Automated evidence — 8 September 2026

- Existing container report `test-results/container/1e9e88ba/results.json` records passing `features/machine-models.spec.ts` and `features/machine-runs.spec.ts` journeys. Reviewed the report and assertions without starting another run.
- The model journey reloads the chosen machine source, sends through the machine consumer and reloads the persisted reply. The lifecycle journey cancels an accepted run, submits late completion with its valid claim token, and verifies the state remains cancelled with its partial text unchanged.
- This validates the web requester and real API lifecycle with a simulated external Ollama response. The combined desktop/iOS journey and disconnect failure remain open.
