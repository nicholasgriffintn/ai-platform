# Model tiers replace automatic routing

- **Change:** Chat requests without a model now carry an optional `model_tier` (`low`, `medium`, `high`, `ultra`) instead of `model_router_mode`; the API resolves a fixed per-tier lineup against the account's executable models and applies the candidate's reasoning effort. Projects store `default_model_tier` (nullable) instead of `default_router_mode`. System tasks (titling, compaction, housekeeping, reading, guardrails, completions) resolve their own lineups. `/models` shows the lineup above the catalogue.
- **Surfaces:** API, web, iOS, sandbox (coding role of the project tier).
- **Prerequisites:** D1 migrations `0029_add_project_default_model_tier`, `0030_map_project_default_model_tier` and `0031_drop_project_default_router_mode` applied with `--remote` on preview and production before deploying the API.
- **Risk if wrong:** Requests without a model fail validation, project tier preferences are lost, or a Free account receives no chat model.
- **Commits:** pending.

## Verify

- [ ] As a Free account, open the composer, choose the Tiers tab and pick Ultra; send a message and confirm the reply comes from a free model (Gemini 3.5 Flash, GLM 5.2 free or DeepSeek V4 Pro) and the request body carries `model_tier: "ultra"`.
- [ ] As a Pro account with an OpenAI key, pick Ultra and confirm the reply comes from GPT-6 Astra with max reasoning, then pick High and confirm GPT-5.6 Luna at xhigh, then pick Medium and confirm GPT-5.6 Luna at medium effort; remove the key and confirm both tiers fall back to the OpenRouter or Workers AI entries.
- [ ] Attach an image with the Low tier and confirm a vision-capable model answers rather than a text-only one.
- [ ] In a Work project, set the default tier to Low, start a conversation with the Default tier and confirm the request omits `model_tier` while the run uses the Low lineup; pick High in the composer and confirm it overrides the project default.
- [ ] Start a sandbox coding run in that project and confirm the run record shows the Low coding model.
- [x] Open `/models` signed out and signed in; confirm each tier card shows the headline model and, when signed in, an "On your plan" line where the account resolves differently.
- [ ] Send a message from iOS without choosing a model and confirm the API accepts the request without `model_router_mode`.
- [ ] Let a conversation reach compaction and confirm the summary is produced by the compaction lineup model (GLM 5.3 Flash on Workers AI for platform accounts).

**Stop and report if:** any chat request without a model returns "Model validation failed", or an existing project shows no default tier after migration when it previously had one.

## Automated evidence — 7 September 2026

- `features/models-page.spec.ts` opens `/models` signed out and confirms all four tier cards name a model rather than reading Nothing configured, then repeats it as a Free account and confirms the lineup says what that plan resolves to where it differs.
- Left open: sending at each tier and checking which model answers, the vision fallback, the project default tier, the sandbox coding model, the iOS request shape and the compaction lineup.
