# New and updated models in the catalogue

- **Change:** A models.dev sync, updated Mistral models, and updated OpenAI realtime models.
- **Surfaces:** web, iOS, API
- **Prerequisites:** none beyond the release prerequisites.
- **Risk if wrong:** a model appears in the picker with no icon, the wrong pricing, or a provider that cannot run it.
- **Commits:** `21abea3c` (#2118), `bf0328b0`, `50f5a81e` (#2161)

## Verify

- [ ] Open the model picker and scan for a coloured initial where artwork should be. Every model and provider should resolve to a real icon.
- [ ] Run one turn on each newly added or renamed model you care about, and confirm it completes rather than 404ing at the provider.
- [ ] Check the Mistral entries specifically, including the OCR model, since they changed twice in this release.
- [ ] Start a realtime session on an OpenAI realtime model and confirm the listed model still exists upstream.

**Stop and report if:** a model in the picker fails at the provider with an unknown-model error. That means the catalogue is ahead of what the account can run.
