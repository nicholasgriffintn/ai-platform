# Shieldstral is selectable as a guardrails provider

- **Change:** Shieldstral joins LlamaGuard, Bedrock, and Mistral as a guardrails provider, backed by a self-hosted OpenAI-compatible endpoint rather than a Mistral API model. `guardrails_provider` is now a closed enum of those four IDs rather than free text. Enabling Shieldstral without a valid endpoint fails closed rather than letting content through unchecked.
- **Surfaces:** web, API
- **Prerequisites:** optional. `SHIELDSTRAL_BASE_URL`, plus `SHIELDSTRAL_API_KEY` when the endpoint needs bearer auth. `SHIELDSTRAL_MODEL`, `SHIELDSTRAL_POLICY`, `SHIELDSTRAL_POLICY_VERSION`, and `SHIELDSTRAL_THRESHOLD` (0 to 1, default `0.5`) are optional.
- **Risk if wrong:** guardrails fail closed and block ordinary chat, or a stored settings value outside the new enum breaks the settings form for that account.
- **Commits:** `e32a6256` (#2150)

## Verify

- [ ] Check the `guardrails_provider` values already stored in production. Anything outside `llamaguard`, `bedrock`, `mistral`, `shieldstral` now fails validation — fix those rows before deploying.
- [ ] Open the settings form with guardrails off. Confirm it loads and saves normally.
- [ ] Turn guardrails on with your existing provider. Confirm chat still works and a clearly disallowed prompt is caught.
- [ ] If you are not running Shieldstral, select it deliberately once, send a message, and confirm the failure is a clear refusal rather than unchecked content passing through. Then set the provider back.
- [ ] If you are running Shieldstral, point `SHIELDSTRAL_BASE_URL` at it, send both an ordinary and a disallowed prompt, and confirm the verdicts and the threshold behave as you expect.
- [ ] Turn guardrails off again and confirm the path is fully out of the way.

**Stop and report if:** ordinary prompts are blocked, or a guardrails failure lets content through instead of refusing.
