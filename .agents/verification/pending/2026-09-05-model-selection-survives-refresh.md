# A selected model survives a page refresh

- **Change:** the composer no longer resets the persisted model to Auto while the model catalogue or the sign-in state is still loading. The "is this model still selectable" rule moved into a shared `isModelReferenceSelectable` helper used by both model-selector fallbacks.
- **Surfaces:** web composer model selector.
- **Prerequisites:** none.
- **Risk if wrong:** every refresh silently drops the chosen model back to Auto and clears reasoning, service tier and verbosity settings; or a genuinely retired or pro-only model stays selected and every send fails.
- **Commits:** pending.

## Verify

- [x] Select a specific model in a conversation, refresh the page, and confirm the selector still shows that model, not Auto.
- [x] Set a reasoning effort or verbosity alongside the model, refresh, and confirm those settings survive too.
- [ ] Refresh on a slow connection (throttled network) and confirm the selector shows its loading state and then the chosen model, never Auto in between.
- [x] Select Auto deliberately, refresh, and confirm it stays Auto.
- [x] As a pro account, select a pro-only model, refresh, and confirm it survives — this is the case where sign-in state resolves after the model list.
- [ ] Sign out with a pro-only model selected and confirm the selector falls back to the default model rather than staying on one the account cannot use.

**Stop and report if:** the selection changes on refresh, or a model the account cannot use stays selected.

## Automated evidence — 5 September 2026

Local Chromium E2E: `features/model-selection.spec.ts`, **retains a Pro model and response controls after reload, then preserves deliberate Auto**, passed. The real completion request retains GPT-6 Astra, High reasoning, Caveman verbosity and Fast processing after reload; a deliberate Auto selection survives reload and omits an explicit model from the next request. Artificially delayed catalogue/authentication and sign-out remain unchecked.

**Conflicting outcome:** the sign-out fallback step predates [ADR 0011](../../skills/polychat-setup/references/architecture/decisions/0011-resolve-models-and-readiness-on-the-server.md), which requires retaining a non-executable selection and asking for an explicit replacement. E2E confirms the selection is retained after sign-out. Leave the older fallback step unchecked; verify blocking and recovery against the current readiness contract.
