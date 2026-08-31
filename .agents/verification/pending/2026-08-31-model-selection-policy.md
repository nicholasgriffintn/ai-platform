# The server decides which model runs

- **Change:** Model defaults no longer sit at each call site. One server-owned policy resolves the model for chat, auxiliary work, generated media, realtime, and sandbox runs from the catalogue, the plan, and the configured providers. Clients present the effective default rather than copying a model ID, provider model identity is preserved through the policy, and response defaults are applied server-side.
- **Surfaces:** web, iOS, API, sandbox
- **Prerequisites:** none beyond the release prerequisites.
- **Risk if wrong:** everyone silently runs on the wrong model, or a Free account is routed to a model it may not use and every turn fails.
- **Commits:** `ada7b003` (#2151), `836ffd32` (#2157), `c3036029` (#2175). See ADR 0030.

## Verify

- [ ] Sign in as a Free account. Confirm the default model shown in the composer is one that account may actually run, and that sending a message works.
- [ ] Sign in as a Pro account and repeat. Confirm the default differs where it should, and that choosing a model by hand still sticks for the conversation.
- [ ] Pick a bring-your-own-key provider you have configured. Confirm its models are offered and that a turn routes to that provider rather than a substitute.
- [ ] Unset a provider key you do not need, reload, and confirm its models stop being offered rather than being offered and failing.
- [ ] Generate an image and start a realtime session without choosing a model. Confirm each resolves one, and that the model reported back matches the provider that ran it.
- [ ] Confirm a sandbox run still resolves a model and completes.

**Stop and report if:** the model named in the UI differs from the model named in the response, or a plan that should have access to a model is refused.
